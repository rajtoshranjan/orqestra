export type SubnetConfig = {
  subnetName: string;
  cidrBlock: string;
  availabilityZone: string;
  mapPublicIpOnLaunch: boolean;
  subnetType: 'public' | 'private';
  isCollapsed?: boolean;
};
