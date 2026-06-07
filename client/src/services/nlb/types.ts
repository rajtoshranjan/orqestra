export type NlbScheme = 'internet-facing' | 'internal';

export type NlbIpAddressType = 'ipv4' | 'dualstack';

export type NlbConfig = {
  loadBalancerName: string;
  scheme: NlbScheme;
  ipAddressType: NlbIpAddressType;
};
