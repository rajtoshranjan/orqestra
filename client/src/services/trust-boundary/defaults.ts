import type { TrustBoundaryConfig } from './types';

export function createDefaultTrustBoundaryConfig(
  index: number,
): TrustBoundaryConfig {
  return {
    boundaryName: `trust-boundary-${index}`,
    isCollapsed: false,
  };
}

export function getTrustBoundaryDisplayName(
  config: TrustBoundaryConfig,
): string {
  return config.boundaryName.trim() || 'Trust Boundary';
}
