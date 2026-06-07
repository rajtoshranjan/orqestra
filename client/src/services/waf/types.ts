export type WafScope = 'REGIONAL' | 'CLOUDFRONT';

export type WafDefaultAction = 'ALLOW' | 'BLOCK';

export type WafConfig = {
  webAclName: string;
  scope: WafScope;
  defaultAction: WafDefaultAction;
};
