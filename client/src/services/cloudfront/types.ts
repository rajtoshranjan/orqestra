export type CloudFrontPriceClass =
  | 'PriceClass_100'
  | 'PriceClass_200'
  | 'PriceClass_All';

export type CloudFrontViewerProtocolPolicy =
  | 'allow-all'
  | 'redirect-to-https'
  | 'https-only';

export type CloudFrontConfig = {
  distributionName: string;
  priceClass: CloudFrontPriceClass;
  viewerProtocolPolicy: CloudFrontViewerProtocolPolicy;
};
