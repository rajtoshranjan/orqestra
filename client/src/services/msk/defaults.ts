import type { MskConfig } from './types';

export function createDefaultMskConfig(index: number): MskConfig {
  return {
    clusterName: `msk-cluster-${index}`,
    kafkaVersion: '3.6.0',
    brokerInstanceType: 'kafka.t3.small',
    brokerCount: 3,
  };
}

export function getMskDisplayName(config: MskConfig): string {
  return config.clusterName.trim() || 'Amazon MSK';
}
