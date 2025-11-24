import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as synced_folder from '@pulumi/synced-folder';

const PROJECT_NAME = 'static-web-cdn';

// Import the program's configuration settings.
const config = new pulumi.Config();
const path = config.get('path') || '../dist';
const indexDocument = config.get('indexDocument') || 'index.html';
const errorDocument = config.get('errorDocument') || 'error.html';
// Domain to publish to (managed in Route53)
const domain = config.get('domain') || 'jonathanpham.com';

// Export the URLs and hostnames of the bucket.
const staticSite = createSiteBucket();
export const { siteURL } = staticSite;
export const siteHostname = staticSite.siteBucketWebsite.websiteDomain;
export const siteBucketName = staticSite.siteBucket.bucket;

// Create an us-east-1 provider for ACM (CloudFront requires certs in us-east-1)
const eastProvider = new aws.Provider('east', { region: 'us-east-1' });

// Create certificate, CloudFront and DNS records for the provided domain
export const { cdn, cdnURL, cdnDomainName } = createCDNforStaticSite(
  staticSite.siteBucket,
  staticSite.siteBucketWebsite,
  domain,
  eastProvider
);

/** S3 Bucket & Website Assets */
// Create an S3 bucket and configure it as a website.
function createSiteBucket() {
  const siteBucket = new aws.s3.Bucket(PROJECT_NAME);

  const siteBucketWebsite = new aws.s3.BucketWebsiteConfiguration(
    `${PROJECT_NAME}_website`,
    {
      bucket: siteBucket.bucket,
      indexDocument: { suffix: indexDocument },
      errorDocument: { key: errorDocument },
    }
  );

  // Configure ownership controls for the new S3 bucket
  const ownershipControls = new aws.s3.BucketOwnershipControls(
    'ownership-controls',
    {
      bucket: siteBucket.bucket,
      rule: {
        objectOwnership: 'ObjectWriter',
      },
    }
  );

  // Configure public ACL block on the new S3 bucket
  const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(
    'public-access-block',
    {
      bucket: siteBucket.bucket,
      blockPublicAcls: false,
    }
  );

  // Use a synced folder to manage the files of the website.
  const bucketFolder = new synced_folder.S3BucketFolder(
    'bucket-folder',
    {
      path: path,
      bucketName: siteBucket.bucket,
      acl: 'public-read',
    },
    { dependsOn: [ownershipControls, publicAccessBlock] }
  );

  const originURL = pulumi.interpolate`http://${siteBucketWebsite.websiteEndpoint}`;

  return {
    siteURL: originURL,
    siteBucket,
    siteBucketWebsite,
  };
}

/** CDN */
function createCDNforStaticSite(
  bucket: aws.s3.Bucket,
  bucketWebsite: aws.s3.BucketWebsiteConfiguration,
  domainName: string,
  eastProvider: aws.Provider
) {
  // Create a CloudFront CDN to distribute and cache the website.
  // Look up the hosted zone for the domain
  const hostedZone = aws.route53.getZone({
    name: domainName,
    privateZone: false,
  });

  // Request a certificate in us-east-1 for the apex and www
  const cert = new aws.acm.Certificate(
    'site-cert',
    {
      domainName: domainName,
      validationMethod: 'DNS',
      subjectAlternativeNames: [`www.${domainName}`],
    },
    { provider: eastProvider }
  );

  // Create DNS validation records in Route53 for each domainValidationOption
  const validationRecords = cert.domainValidationOptions.apply((dvos) =>
    dvos.map(
      (dvo, i) =>
        new aws.route53.Record(`cert-validation-${i}`, {
          name: dvo.resourceRecordName,
          zoneId: hostedZone.then((z) => z.id),
          type: dvo.resourceRecordType,
          records: [dvo.resourceRecordValue],
          ttl: 600,
        })
    )
  );

  // Validate the certificate once DNS records are created
  const certValidation = new aws.acm.CertificateValidation(
    'cert-validation',
    {
      certificateArn: cert.arn,
      validationRecordFqdns: validationRecords.apply((records) =>
        records.map((r) => r.fqdn)
      ),
    },
    { provider: eastProvider }
  );

  const cdn = new aws.cloudfront.Distribution(
    'cdn',
    {
      enabled: true,
      origins: [
        {
          originId: bucket.arn,
          domainName: bucketWebsite.websiteDomain,
          customOriginConfig: {
            originProtocolPolicy: 'http-only',
            httpPort: 80,
            httpsPort: 443,
            originSslProtocols: ['TLSv1.2'],
          },
        },
      ],
      aliases: [domainName, `www.${domainName}`],
      defaultRootObject: indexDocument,
      defaultCacheBehavior: {
        targetOriginId: bucket.arn,
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
        defaultTtl: 600,
        maxTtl: 600,
        minTtl: 600,
        forwardedValues: {
          queryString: true,
          cookies: {
            forward: 'all',
          },
        },
      },
      priceClass: 'PriceClass_100',
      customErrorResponses: [
        {
          errorCode: 404,
          responseCode: 404,
          responsePagePath: `/${errorDocument}`,
        },
      ],
      restrictions: {
        geoRestriction: {
          restrictionType: 'none',
        },
      },
      viewerCertificate: {
        acmCertificateArn: certValidation.certificateArn || cert.arn,
        sslSupportMethod: 'sni-only',
        minimumProtocolVersion: 'TLSv1.2_2019',
      },
    },
    { dependsOn: [certValidation] }
  );

  // Create Route53 alias records pointing to CloudFront
  const aliasRecordA = new aws.route53.Record('cdn-alias-A', {
    name: domainName,
    zoneId: hostedZone.then((z) => z.id),
    type: 'A',
    aliases: [
      {
        name: cdn.domainName,
        zoneId: cdn.hostedZoneId,
        evaluateTargetHealth: false,
      },
    ],
  });

  const aliasRecordAAAA = new aws.route53.Record('cdn-alias-AAAA', {
    name: domainName,
    zoneId: hostedZone.then((z) => z.id),
    type: 'AAAA',
    aliases: [
      {
        name: cdn.domainName,
        zoneId: cdn.hostedZoneId,
        evaluateTargetHealth: false,
      },
    ],
  });

  const aliasRecordA_www = new aws.route53.Record('cdn-alias-A-www', {
    name: `www.${domainName}`,
    zoneId: hostedZone.then((z) => z.id),
    type: 'A',
    aliases: [
      {
        name: cdn.domainName,
        zoneId: cdn.hostedZoneId,
        evaluateTargetHealth: false,
      },
    ],
  });

  const aliasRecordAAAA_www = new aws.route53.Record('cdn-alias-AAAA-www', {
    name: `www.${domainName}`,
    zoneId: hostedZone.then((z) => z.id),
    type: 'AAAA',
    aliases: [
      {
        name: cdn.domainName,
        zoneId: cdn.hostedZoneId,
        evaluateTargetHealth: false,
      },
    ],
  });

  return {
    cdn,
    cdnURL: pulumi.interpolate`https://${cdn.domainName}`,
    cdnDomainName: cdn.domainName,
  };
}
