import type { SesConfig } from './types';

export function createDefaultSesConfig(index: number): SesConfig {
  return {
    identityName: `notifications-${index}.example.com`,
    identityType: 'Domain',
    mailFromDomain: `mail-${index}.example.com`,
  };
}

export function getSesDisplayName(config: SesConfig): string {
  return config.identityName.trim() || 'Amazon SES';
}
