import { z } from 'zod';

export const lambdaConfigSchema = z.object({
  functionName: z
    .string()
    .min(1, 'Function name is required.')
    .regex(
      /^[a-zA-Z0-9-_]{1,64}$/,
      'Use 1-64 letters, numbers, hyphens, or underscores.',
    ),
  runtime: z.enum(['nodejs20.x', 'nodejs22.x', 'python3.12']),
  handler: z.string().min(1, 'Handler is required.'),
  memorySize: z
    .number()
    .min(128, 'Memory must be between 128 MB and 10240 MB.')
    .max(10240, 'Memory must be between 128 MB and 10240 MB.'),
  timeout: z
    .number()
    .min(1, 'Timeout must be between 1 and 900 seconds.')
    .max(900, 'Timeout must be between 1 and 900 seconds.'),
  description: z.string(),
  code: z
    .string()
    .min(1, 'Paste the function code before planning or deploying.'),
  environmentVariables: z
    .array(
      z.object({
        id: z.string(),
        key: z.string(),
        value: z.string(),
      }),
    )
    .superRefine((vars, ctx) => {
      const seen = new Set<string>();
      for (let i = 0; i < vars.length; i++) {
        const entry = vars[i];
        const key = entry.key.trim();
        const val = entry.value.trim();
        if (!key && !val) continue; // skip completely empty entries
        if (!key) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Each environment variable needs a key.',
            path: [i, 'key'],
          });
          continue;
        }
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Environment keys must start with a letter and use only letters, numbers, or underscores.',
            path: [i, 'key'],
          });
          continue;
        }
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Environment variable keys must be unique.',
            path: [i, 'key'],
          });
          continue;
        }
        seen.add(key);
      }
    }),
});
export default lambdaConfigSchema;
