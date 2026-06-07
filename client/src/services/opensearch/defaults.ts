import type { OpenSearchConfig } from './types';

export function createDefaultOpenSearchConfig(index: number): OpenSearchConfig {
  return {
    domainName: `search-domain-${index}`,
    engineVersion: 'OpenSearch_2.11',
    instanceType: 't3.small.search',
  };
}

export function getOpenSearchDisplayName(config: OpenSearchConfig): string {
  return config.domainName.trim() || 'OpenSearch';
}
