import type { S3Config } from './types';

export function createDefaultS3Config(index: number): S3Config {
  return {
    bucketName: `orqestra-bucket-${index}`,
    versioning: false,
  };
}

export function getS3DisplayName(config: S3Config): string {
  return config.bucketName.trim() || 'S3 Bucket';
}
