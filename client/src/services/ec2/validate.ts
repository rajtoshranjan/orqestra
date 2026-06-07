import { z } from 'zod';
import type { ServiceValidationErrors } from '../types';
import type { EC2Config } from './types';

const ec2ConfigSchema = z.object({
  instanceName: z.string().min(1, 'Instance Name is required.'),
  instanceType: z.string().min(1, 'Instance Type is required.'),
  ami: z.string(),
  keyPairName: z.string(),
  publicIpEnabled: z.boolean(),
});

export function validateEC2Config(config: EC2Config): ServiceValidationErrors {
  const result = ec2ConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
