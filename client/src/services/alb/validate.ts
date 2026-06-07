import { z } from 'zod';
import type { ServiceValidationErrors } from '../types';
import type { AlbConfig } from './types';

const albConfigSchema = z.object({
  loadBalancerName: z.string().min(1, 'Load Balancer Name is required.'),
  scheme: z.enum(['internet-facing', 'internal']),
  lbType: z.enum(['application', 'network']),
});

export function validateAlbConfig(config: AlbConfig): ServiceValidationErrors {
  const result = albConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
