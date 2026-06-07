import type { EC2Config } from './types';

export function createDefaultEC2Config(index: number): EC2Config {
  return {
    instanceName: `ec2-instance-${index}`,
    instanceType: 't3.micro',
    ami: 'ami-0c55b159cbfafe1f0',
    keyPairName: '',
    publicIpEnabled: false,
  };
}

export function getEC2DisplayName(config: EC2Config): string {
  return config.instanceName.trim() || 'EC2 Instance';
}
