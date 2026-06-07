export type VPCConfig = {
  vpcName: string;
  cidrBlock: string;
  enableDnsHostnames: boolean;
  enableDnsSupport: boolean;
  isCollapsed?: boolean;
};
