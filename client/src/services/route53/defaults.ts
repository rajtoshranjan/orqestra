import type { Route53Config } from './types';

export function createDefaultRoute53Config(index: number): Route53Config {
  return {
    hostedZoneName: `example-${index}.com`,
    zoneType: 'public',
  };
}

export function getRoute53DisplayName(config: Route53Config): string {
  return config.hostedZoneName.trim() || 'Route 53';
}
