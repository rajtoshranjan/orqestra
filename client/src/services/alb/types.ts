export type AlbScheme = 'internet-facing' | 'internal';
export type AlbType = 'application' | 'network';

export type AlbConfig = {
  loadBalancerName: string;
  scheme: AlbScheme;
  lbType: AlbType;
};
