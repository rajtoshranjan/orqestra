export type EcsClusterConfig = {
  clusterName: string;
  launchType: 'FARGATE' | 'EC2' | 'EXTERNAL';
};
