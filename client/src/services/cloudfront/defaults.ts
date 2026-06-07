import type { CloudFrontConfig } from './types';

export function createDefaultCloudFrontConfig(index: number): CloudFrontConfig {
  return {
    distributionName: `cdn-distribution-${index}`,
    priceClass: 'PriceClass_100',
    viewerProtocolPolicy: 'redirect-to-https',
  };
}

export function getCloudFrontDisplayName(config: CloudFrontConfig): string {
  return config.distributionName.trim() || 'CloudFront';
}
