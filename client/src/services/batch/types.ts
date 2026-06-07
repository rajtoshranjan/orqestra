export type BatchConfig = {
  computeEnvironmentName: string;
  computeType: 'EC2' | 'FARGATE' | 'SPOT';
};
