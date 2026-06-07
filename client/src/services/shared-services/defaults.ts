import type { SharedServicesConfig } from './types';

export function createDefaultSharedServicesConfig(
  index: number,
): SharedServicesConfig {
  return {
    servicesName: `shared-services-${index}`,
    isCollapsed: false,
  };
}

export function getSharedServicesDisplayName(
  config: SharedServicesConfig,
): string {
  return config.servicesName.trim() || 'Shared Services';
}
