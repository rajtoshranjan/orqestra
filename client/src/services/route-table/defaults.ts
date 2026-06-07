import type { RouteTableConfig } from './types';

export function createDefaultRouteTableConfig(index: number): RouteTableConfig {
  return {
    routeTableName: `route-table-${index}`,
  };
}

export function getRouteTableDisplayName(config: RouteTableConfig): string {
  return config.routeTableName.trim() || 'Route Table';
}
