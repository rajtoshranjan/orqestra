import { z } from 'zod';

import type { ServiceValidationErrors } from '../types';
import type { RouteTableConfig } from './types';

const routeTableConfigSchema = z.object({
  routeTableName: z.string().min(1, 'Route Table Name is required.'),
});

export function validateRouteTableConfig(
  config: RouteTableConfig,
): ServiceValidationErrors {
  const result = routeTableConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
