import type { KMSConfig } from './types';

export function createDefaultKMSConfig(index: number): KMSConfig {
  return {
    keyAlias: `alias/key-${index}`,
    description: 'Encryption key',
    keyUsage: 'ENCRYPT_DECRYPT',
    multiRegion: false,
  };
}

export function getKMSDisplayName(config: KMSConfig): string {
  return config.keyAlias.trim() || 'KMS Key';
}
