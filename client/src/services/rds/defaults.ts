import type { RDSConfig } from './types';

export function createDefaultRDSConfig(index: number): RDSConfig {
  return {
    instanceIdentifier: `rds-db-${index}`,
    engine: 'postgres',
    instanceClass: 'db.t3.micro',
    allocatedStorage: 20,
    multiAz: false,
  };
}

export function getRDSDisplayName(config: RDSConfig): string {
  return config.instanceIdentifier.trim() || 'RDS Instance';
}
