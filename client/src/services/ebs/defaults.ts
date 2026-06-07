import type { EBSConfig } from './types';

export function createDefaultEBSConfig(index: number): EBSConfig {
  return {
    volumeName: `ebs-volume-${index}`,
    volumeType: 'gp3',
    sizeGb: 20,
    encrypted: true,
  };
}

export function getEBSDisplayName(config: EBSConfig): string {
  return config.volumeName.trim() || 'EBS Volume';
}
