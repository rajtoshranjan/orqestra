import type { EksClusterConfig } from './types';

export function createDefaultEksClusterConfig(index: number): EksClusterConfig {
  return {
    clusterName: `eks-cluster-${index}`,
    kubernetesVersion: '1.30',
  };
}

export function getEksClusterDisplayName(config: EksClusterConfig): string {
  return config.clusterName.trim() || 'EKS Cluster';
}
