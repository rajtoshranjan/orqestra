export type AuroraEngine = 'aurora-mysql' | 'aurora-postgresql';

export type AuroraConfig = {
  clusterIdentifier: string;
  engine: AuroraEngine;
  engineVersion: string;
  serverless: boolean;
};
