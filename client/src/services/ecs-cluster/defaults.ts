import type { EcsClusterConfig } from './types';

export function createDefaultEcsClusterConfig(index: number): EcsClusterConfig {
  return {
    clusterName: `ecs-cluster-${index}`,
    launchType: 'FARGATE',
  };
}

export function getEcsClusterDisplayName(config: EcsClusterConfig): string {
  return config.clusterName.trim() || 'ECS Cluster';
}
