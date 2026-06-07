import type { EFSConfig } from './types';

export function createDefaultEFSConfig(index: number): EFSConfig {
  return {
    creationToken: `efs-${index}`,
    encrypted: true,
    performanceMode: 'generalPurpose',
    throughputMode: 'bursting',
    accessPoints: [],
  };
}

export function getEFSDisplayName(config: EFSConfig): string {
  return config.creationToken.trim() || 'EFS File System';
}
