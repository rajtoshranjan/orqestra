import type { GlueConfig } from './types';

export function createDefaultGlueConfig(index: number): GlueConfig {
  return {
    databaseName: `glue_database_${index}`,
    crawlerName: `glue-crawler-${index}`,
    dataSourceType: 'S3',
  };
}

export function getGlueDisplayName(config: GlueConfig): string {
  return config.databaseName.trim() || 'AWS Glue';
}
