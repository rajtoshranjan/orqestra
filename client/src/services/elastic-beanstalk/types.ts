export type ElasticBeanstalkConfig = {
  applicationName: string;
  platform: string;
  environmentTier: 'WebServer' | 'Worker';
};
