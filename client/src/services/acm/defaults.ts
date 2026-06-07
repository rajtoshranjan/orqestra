import type { AcmConfig } from './types';

export function createDefaultAcmConfig(index: number): AcmConfig {
  return {
    certificateName: `certificate-${index}`,
    domainName: `app-${index}.example.com`,
    validationMethod: 'DNS',
  };
}

export function getAcmDisplayName(config: AcmConfig): string {
  return config.certificateName.trim() || 'ACM Certificate';
}
