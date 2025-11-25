import * as pulumi from '@pulumi/pulumi';
import { cloudfront } from '@pulumi/aws';

import {
  createSiteBucket,
  setCloudFrontBucketPolicy,
  setPublicBucketPolicy,
} from './modules/s3_website';
import {
  createCertificate,
  setupS3SiteCloudFrontDomainDistribution,
} from './modules/domain_routing';

const PROJECT_NAME = 'static-web-cdn';
const STACK_NAME = pulumi.getStack();

// Load the Pulumi program configuration. These act as the "parameters" to the Pulumi program,
// so that different Pulumi Stacks can be brought up using the same code.

const stackConfig = new pulumi.Config();

const config = {
  // pathToWebsiteContents is a relativepath to the website's contents.
  pathToWebsiteContents: stackConfig.require('pathToWebsiteContents'),
  indexDocument: stackConfig.get('indexDocument') || 'index.html',
  errorDocument: stackConfig.get('errorDocument') || 'error.html',
  /* All the below are OPTIONAL (for Prod stack) */
  // Domain to publish to (managed in Route53)
  // targetDomain is the domain/host to serve content at.
  target: stackConfig.get('targetDomain') || 'staging',
  // ACM certificate ARN for the target domain; must be in the us-east-1 region. If omitted, an ACM certificate will be created.
  certificateArn: stackConfig.get('certificateArn'),
  // If true create an A record for the www subdomain of targetDomain pointing to the generated cloudfront distribution.
  // If a certificate was generated it will support this subdomain.
  // default: false
  includeWWW: stackConfig.getBoolean('includeWWW') ?? false,
  syncAssetsToBucket: stackConfig.getBoolean('syncAssetsToBucket') ?? false,
};

// Create S3 Static Site Bucket from ../dist
const staticSite = createSiteBucket(
  `${PROJECT_NAME}-${STACK_NAME}`,
  config.pathToWebsiteContents,
  config.indexDocument,
  config.errorDocument,
  config.syncAssetsToBucket
);

// Set Bucket Policy depending on whether CDN is used or not
let cdn: cloudfront.Distribution | undefined = undefined;
let certificateArn: pulumi.Input<string> = config.certificateArn!;
if (config.target === 'staging') {
  setPublicBucketPolicy(config.pathToWebsiteContents, staticSite.contentBucket);
} else {
  // Create certificate, CloudFront and DNS records for the provided domain
  /**
   * Only provision a certificate (and related resources) if a certificateArn is _not_ provided via configuration.
   */
  if (!certificateArn) {
    certificateArn = createCertificate(config.target, config.includeWWW);
    console.log(`Created certificate for ${config.target}`, certificateArn);
  }
  // Export properties from this stack. This prints them at the end of `pulumi up` and
  // makes them easier to access from pulumi.com.
  const { cdn: cloudFrontDistribution, originAccessIdentity } =
    setupS3SiteCloudFrontDomainDistribution(
      staticSite.contentBucket,
      staticSite.logsBucket,
      config.target,
      certificateArn,
      config.includeWWW
    );

  setCloudFrontBucketPolicy(
    staticSite.contentBucket,
    config.pathToWebsiteContents,
    originAccessIdentity
  );
  cdn = cloudFrontDistribution;
}

// Export properties from this stack. This prints them at the end of `pulumi up` and
// makes them easier to access from pulumi.com.
export const { contentBucketUri, contentBucketWebsiteEndpoint } =
  staticSite.output;
export const targetDomainEndpoint = cdn
  ? `https://${config.target}/`
  : contentBucketWebsiteEndpoint;

export const cdnDomainName = cdn?.domainName;
export const certificateUsed = certificateArn;
