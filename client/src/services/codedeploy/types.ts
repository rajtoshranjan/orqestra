export type CodeDeployConfig = {
  applicationName: string;
  computePlatform: 'Server' | 'Lambda' | 'ECS';
};
