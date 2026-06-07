import type { XRayConfig } from './types';

export function createDefaultXRayConfig(index: number): XRayConfig {
  return {
    groupName: `xray-group-${index}`,
    samplingRate: 5,
  };
}

export function getXRayDisplayName(config: XRayConfig): string {
  return config.groupName.trim() || 'X-Ray Group';
}
