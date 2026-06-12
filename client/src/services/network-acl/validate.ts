import { networkAclConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { NetworkAclConfig } from './types';

export function validateNetworkAclConfig(
  config: NetworkAclConfig,
): ServiceValidationErrors {
  const result = networkAclConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
