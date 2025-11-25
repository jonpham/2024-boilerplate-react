// Copyright 2016-2025, Pulumi Corporation.  All rights reserved.
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

const TEN_MINUTES = 60 * 10;

export function createCertificate(
  targetDomain: string,
  includeWWW: boolean = false
): pulumi.OutputInstance<string> {
  const { subdomain, parentDomain } = getDomainAndSubdomain(targetDomain);
  const eastRegion = new aws.Provider('east', {
    profile: aws.config.profile,
    region: 'us-east-1', // Per AWS, ACM certificate must be in the us-east-1 region.
  });

  // if config.includeWWW include required subjectAlternativeNames to support the www subdomain
  const certificateConfig: aws.acm.CertificateArgs = {
    domainName: targetDomain,
    validationMethod: 'DNS',
    subjectAlternativeNames:
      includeWWW && !subdomain ? [`www.${targetDomain}`] : [],
  };

  const certificate = new aws.acm.Certificate(
    'certificate',
    certificateConfig,
    { provider: eastRegion }
  );

  const hostedZoneId: pulumi.Input<string> = pulumi.runtime.isDryRun()
    ? pulumi.output('Z000000')
    : aws.route53
        .getZone({ name: parentDomain }, { async: true })
        .then((zone) => zone.zoneId);

  /**
   *  Create a DNS record to prove that we _own_ the domain we're requesting a certificate for.
   *  See https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-validate-dns.html for more info.
   */
  const certificateValidationDomain = new aws.route53.Record(
    `${targetDomain}-validation`,
    {
      name: certificate.domainValidationOptions[0].resourceRecordName,
      zoneId: hostedZoneId,
      type: certificate.domainValidationOptions[0].resourceRecordType,
      records: [certificate.domainValidationOptions[0].resourceRecordValue],
      ttl: TEN_MINUTES,
    }
  );

  // if config.includeWWW ensure we validate the www subdomain as well
  let subdomainCertificateValidationDomain;
  if (includeWWW) {
    subdomainCertificateValidationDomain = new aws.route53.Record(
      `${targetDomain}-validation2`,
      {
        name: certificate.domainValidationOptions[1].resourceRecordName,
        zoneId: hostedZoneId,
        type: certificate.domainValidationOptions[1].resourceRecordType,
        records: [certificate.domainValidationOptions[1].resourceRecordValue],
        ttl: TEN_MINUTES,
      }
    );
  }

  // if config.includeWWW include the validation record for the www subdomain
  const validationRecordFqdns =
    subdomainCertificateValidationDomain === undefined
      ? [certificateValidationDomain.fqdn]
      : [
          certificateValidationDomain.fqdn,
          subdomainCertificateValidationDomain.fqdn,
        ];

  /**
   * This is a _special_ resource that waits for ACM to complete validation via the DNS record
   * checking for a status of "ISSUED" on the certificate itself. No actual resources are
   * created (or updated or deleted).
   *
   * See https://www.terraform.io/docs/providers/aws/r/acm_certificate_validation.html for slightly more detail
   * and https://github.com/terraform-providers/terraform-provider-aws/blob/master/aws/resource_aws_acm_certificate_validation.go
   * for the actual implementation.
   */
  const certificateValidation = new aws.acm.CertificateValidation(
    'certificateValidation',
    {
      certificateArn: certificate.arn,
      validationRecordFqdns: validationRecordFqdns,
    },
    { provider: eastRegion }
  );

  return certificateValidation.certificateArn;
}

export function setupS3SiteCloudFrontDomainDistribution(
  contentBucket: aws.s3.Bucket,
  logsBucket: aws.s3.Bucket,
  targetDomain: string,
  certificateArn: string | pulumi.Input<string>,
  includeWWW: boolean = false
): {
  cdn: aws.cloudfront.Distribution;
  originAccessIdentity: aws.cloudfront.OriginAccessIdentity;
} {
  // Generate Origin Access Identity to access the private s3 bucket.
  const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(
    'originAccessIdentity',
    {
      comment: 'this is needed to setup s3 polices and make s3 not public.',
    }
  );

  // if config.includeWWW include an alias for the www subdomain
  const distributionAliases = includeWWW
    ? [targetDomain, `www.${targetDomain}`]
    : [targetDomain];

  // distributionArgs configures the CloudFront distribution. Relevant documentation:
  // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html
  // https://www.terraform.io/docs/providers/aws/r/cloudfront_distribution.html
  const distributionArgs: aws.cloudfront.DistributionArgs = {
    enabled: true,
    // Alternate aliases the CloudFront distribution can be reached at, in addition to https://xxxx.cloudfront.net.
    // Required if you want to access the distribution via config.targetDomain as well.
    aliases: distributionAliases,

    // We only specify one origin for this distribution, the S3 content bucket.
    origins: [
      {
        originId: contentBucket.arn,
        domainName: contentBucket.bucketRegionalDomainName,
        s3OriginConfig: {
          originAccessIdentity:
            originAccessIdentity.cloudfrontAccessIdentityPath,
        },
      },
    ],

    defaultRootObject: 'index.html',

    // A CloudFront distribution can configure different cache behaviors based on the request path.
    // Here we just specify a single, default cache behavior which is just read-only requests to S3.
    defaultCacheBehavior: {
      targetOriginId: contentBucket.arn,

      viewerProtocolPolicy: 'redirect-to-https',
      allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
      cachedMethods: ['GET', 'HEAD', 'OPTIONS'],

      forwardedValues: {
        cookies: { forward: 'none' },
        queryString: false,
      },

      minTtl: 0,
      defaultTtl: TEN_MINUTES,
      maxTtl: TEN_MINUTES,
    },

    // "All" is the most broad distribution, and also the most expensive.
    // "100" is the least broad, and also the least expensive.
    priceClass: 'PriceClass_100',

    // You can customize error responses. When CloudFront receives an error from the origin (e.g. S3 or some other
    // web service) it can return a different error code, and return the response for a different resource.
    customErrorResponses: [
      { errorCode: 404, responseCode: 404, responsePagePath: '/404.html' },
    ],

    restrictions: {
      geoRestriction: {
        restrictionType: 'none',
      },
    },

    viewerCertificate: {
      acmCertificateArn: certificateArn, // Per AWS, ACM certificate must be in the us-east-1 region.
      sslSupportMethod: 'sni-only',
    },

    loggingConfig: {
      bucket: logsBucket.bucketDomainName,
      includeCookies: false,
      prefix: `${targetDomain}/`,
    },
  };

  const cdn = new aws.cloudfront.Distribution('cdn', distributionArgs);
  const aRecord = createAliasRecord(targetDomain, cdn);

  if (includeWWW) {
    const cnameRecord = createWWWAliasRecord(targetDomain, cdn);
  }

  return { cdn, originAccessIdentity };
}

// Split a domain name into its subdomain and parent domain names.
// e.g. "www.example.com" => "www", "example.com".
function getDomainAndSubdomain(domain: string): {
  subdomain: string;
  parentDomain: string;
} {
  const parts = domain.split('.');
  if (parts.length < 2) {
    throw new Error(`No TLD found on ${domain}`);
  }
  // No subdomain, e.g. awesome-website.com.
  if (parts.length === 2) {
    return { subdomain: '', parentDomain: domain };
  }

  const subdomain = parts[0];
  parts.shift(); // Drop first element.
  return {
    subdomain,
    // Trailing "." to canonicalize domain.
    parentDomain: parts.join('.') + '.',
  };
}

// Creates a new Route53 DNS record pointing the domain to the CloudFront distribution.
function createAliasRecord(
  targetDomain: string,
  distribution: aws.cloudfront.Distribution
): aws.route53.Record {
  const domainParts = getDomainAndSubdomain(targetDomain);
  const hostedZoneId: pulumi.Input<string> = pulumi.runtime.isDryRun()
    ? pulumi.output('Z000000')
    : aws.route53
        .getZone({ name: domainParts.parentDomain }, { async: true })
        .then((zone) => zone.zoneId);
  return new aws.route53.Record(targetDomain, {
    name: domainParts.subdomain,
    zoneId: hostedZoneId,
    type: 'A',
    aliases: [
      {
        name: distribution.domainName,
        zoneId: distribution.hostedZoneId,
        evaluateTargetHealth: true,
      },
    ],
  });
}

function createWWWAliasRecord(
  targetDomain: string,
  distribution: aws.cloudfront.Distribution
): aws.route53.Record {
  const domainParts = getDomainAndSubdomain(targetDomain);
  const hostedZoneId: pulumi.Input<string> = pulumi.runtime.isDryRun()
    ? pulumi.output('Z000000')
    : aws.route53
        .getZone({ name: domainParts.parentDomain }, { async: true })
        .then((zone) => zone.zoneId);

  return new aws.route53.Record(`${targetDomain}-www-alias`, {
    name: `www.${targetDomain}`,
    zoneId: hostedZoneId,
    type: 'A',
    aliases: [
      {
        name: distribution.domainName,
        zoneId: distribution.hostedZoneId,
        evaluateTargetHealth: true,
      },
    ],
  });
}
