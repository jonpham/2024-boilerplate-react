import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as synced_folder from '@pulumi/synced-folder';

const PROJECT_NAME = 'static-web-cdn';

// Import the program's configuration settings.
const config = new pulumi.Config();
const path = config.get('path') || '../dist';
const indexDocument = config.get('indexDocument') || 'index.html';
const errorDocument = config.get('errorDocument') || 'error.html';

// Export the URLs and hostnames of the bucket.
const staticSite = createSiteBucket();
export const { siteURL } = staticSite;
export const siteHostname = staticSite.siteBucketWebsite.websiteDomain;
export const siteBucketName = staticSite.siteBucket.bucket;

// Export the URLs and hostnames of the CDN distribution.
// export const { cdn, cdnURL } = createCDNforStaticSite(
//   staticSite.siteBucket,
//   staticSite.siteBucketWebsite
// );

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
  bucketWebsite: aws.s3.BucketWebsiteConfiguration
) {
  // Create a CloudFront CDN to distribute and cache the website.
  const cdn = new aws.cloudfront.Distribution('cdn', {
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
      cloudfrontDefaultCertificate: true,
    },
  });

  return {
    cdn,
    cdnURL: pulumi.interpolate`https://${cdn.domainName}`,
  };
}
