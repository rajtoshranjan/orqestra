import type { GuardDutyConfig } from './types';

export function createDefaultGuardDutyConfig(index: number): GuardDutyConfig {
  return {
    detectorName: `guardduty-detector-${index}`,
    findingPublishingFrequency: 'SIX_HOURS',
  };
}

export function getGuardDutyDisplayName(config: GuardDutyConfig): string {
  return config.detectorName.trim() || 'GuardDuty';
}
