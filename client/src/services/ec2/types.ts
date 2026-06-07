export type EC2Config = {
  instanceName: string;
  instanceType: string;
  ami: string;
  keyPairName: string;
  publicIpEnabled: boolean;
};
