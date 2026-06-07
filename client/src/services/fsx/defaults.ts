import type { FSxConfig } from './types';

export function createDefaultFSxConfig(index: number): FSxConfig {
  return {
    fileSystemName: `fsx-${index}`,
    fileSystemType: 'LUSTRE',
    storageCapacityGb: 1200,
  };
}

export function getFSxDisplayName(config: FSxConfig): string {
  return config.fileSystemName.trim() || 'FSx File System';
}
