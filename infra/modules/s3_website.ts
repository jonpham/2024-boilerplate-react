import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import * as synced_folder from '@pulumi/synced-folder';

import * as fs from 'fs';
import * as mime from 'mime';
import * as path from 'path';

import { configureACL } from './acl';

export function createSiteBucket(
  projectName: string,
  websiteAssetPath: string,
  indexDoc: string,
  errorDoc: string,
  syncAssetsToBucket: boolean = false
) {
  // contentBucket is the S3 bucket that the website's contents will be stored in.
  const contentBucket = new aws.s3.Bucket(`${projectName}-content`);

  // logsBucket is an S3 bucket that will contain the CDN's request logs.
  const logsBucket = new aws.s3.Bucket(`${projectName}-logs`);
  configureACL('requestLogs', logsBucket, 'private');

  const contentBucketWebsite = new aws.s3.BucketWebsiteConfiguration(
    'contentBucketWebsite',
    {
      bucket: contentBucket.bucket,
      indexDocument: { suffix: indexDoc },
      errorDocument: { key: errorDoc },
    }
  );

  if (syncAssetsToBucket === true) {
    // Sync the contents of the source directory with the S3 bucket, which will in-turn show up on the CDN.
    const webContentsRootPath = path.join(process.cwd(), websiteAssetPath);
    console.log('Syncing contents from local disk at', webContentsRootPath);
    crawlDirectory(webContentsRootPath, (filePath: string) => {
      const relativeFilePath = filePath.replace(webContentsRootPath + '/', '');
      const contentFile = new aws.s3.BucketObject(
        relativeFilePath,
        {
          key: relativeFilePath,
          bucket: contentBucket.bucket,
          contentType: mime.getType(filePath) || undefined,
          source: new pulumi.asset.FileAsset(filePath),
        },
        {
          parent: contentBucket,
        }
      );
    });
  }

  return {
    contentBucket,
    contentBucketWebsite,
    logsBucket,
    output: {
      contentBucketUri: pulumi.interpolate`s3://${contentBucket.bucket}`,
      contentBucketWebsiteEndpoint: contentBucketWebsite.websiteEndpoint,
    },
  };
}

export function setPublicBucketPolicy(
  contentPath: string,
  contentBucket: aws.s3.Bucket
) {
  // Configure ownership controls for the new S3 bucket
  const ownershipControls = new aws.s3.BucketOwnershipControls(
    'ownership-controls',
    {
      bucket: contentBucket.bucket,
      rule: {
        objectOwnership: 'ObjectWriter',
      },
    }
  );

  // Configure public ACL block on the new S3 bucket
  const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(
    'public-access-block',
    {
      bucket: contentBucket.bucket,
      blockPublicAcls: false,
    }
  );

  // Use a synced folder to manage the files of the website.
  const bucketFolder = new synced_folder.S3BucketFolder(
    'bucket-folder',
    {
      path: contentPath,
      bucketName: contentBucket.bucket,
      acl: 'public-read',
    },
    { dependsOn: [ownershipControls, publicAccessBlock] }
  );
}

export function setCloudFrontBucketPolicy(
  contentBucket: aws.s3.Bucket,
  contentPath: string,
  originAccessIdentity: aws.cloudfront.OriginAccessIdentity
) {
  const bucketPolicy = new aws.s3.BucketPolicy('bucketPolicy', {
    bucket: contentBucket.id, // refer to the bucket created earlier
    policy: pulumi.jsonStringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            AWS: originAccessIdentity.iamArn,
          }, // Only allow Cloudfront read access.
          Action: ['s3:GetObject'],
          Resource: [pulumi.interpolate`${contentBucket.arn}/*`], // Give Cloudfront access to the entire bucket.
        },
      ],
    }),
  });

  // Use a synced folder to manage the files of the website.
  const bucketFolder = new synced_folder.S3BucketFolder(
    'bucket-folder',
    {
      path: contentPath,
      bucketName: contentBucket.bucket,
      acl: 'private',
    },
    { dependsOn: [bucketPolicy] }
  );
}

// crawlDirectory recursive crawls the provided directory, applying the provided function
// to every file it contains. Doesn't handle cycles from symlinks.
function crawlDirectory(dir: string, f: (_: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = `${dir}/${file}`;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      crawlDirectory(filePath, f);
    }
    if (stat.isFile()) {
      f(filePath);
    }
  }
}
