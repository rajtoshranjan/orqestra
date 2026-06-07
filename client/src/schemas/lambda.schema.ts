import { z } from 'zod';

export const lambdaConfigSchema = z
  .object({
    functionName: z
      .string()
      .min(1, 'Function name is required.')
      .regex(
        /^[a-zA-Z0-9-_]{1,64}$/,
        'Use 1-64 letters, numbers, hyphens, or underscores.',
      ),
    runtime: z.enum([
      'nodejs20.x',
      'nodejs22.x',
      'python3.12',
      'java17',
      'dotnet8',
      'go1.x',
      'ruby3.2',
      'provided.al2023',
    ]),
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
    code: z.string().optional(),
    packageType: z.enum(['Zip', 'Image']),
    architecture: z.enum(['x86_64', 'arm64']),

    // Container settings
    imageUri: z.string().optional(),
    imageTag: z.string().optional(),
    imageDigest: z.string().optional(),

    // Concurrency & SnapStart
    reservedConcurrency: z.number().min(0).optional().nullable(),
    provisionedConcurrency: z.number().min(0).optional().nullable(),
    snapStart: z.enum(['None', 'PublishedVersions']),
    ephemeralStorage: z.number().min(512).max(10240).default(512),

    // Function URL settings
    enableFunctionUrl: z.boolean(),
    functionUrlAuthType: z.enum(['NONE', 'AWS_IAM']),

    // Monitoring
    logRetention: z.number().default(14),
    tracingMode: z.enum(['Active', 'PassThrough']),
    lambdaInsights: z.boolean(),

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
  })
  .superRefine((data, ctx) => {
    // If ZIP: handler and code are required (unless a custom runtime like provided.al2023 is used without inline code editor support, but for standard we expect inline/zip code)
    if (data.packageType === 'Zip') {
      if (!data.handler) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Handler is required for ZIP package type.',
          path: ['handler'],
        });
      }
    }

    // If Image: imageUri is required
    if (data.packageType === 'Image') {
      if (!data.imageUri || !data.imageUri.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Container Image URI is required for Image package type.',
          path: ['imageUri'],
        });
      }
    }

    // SnapStart is only supported for Java 17 / java21
    if (data.snapStart === 'PublishedVersions') {
      if (!data.runtime.startsWith('java')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SnapStart is only supported for Java runtimes.',
          path: ['snapStart'],
        });
      }
    }
  });

export default lambdaConfigSchema;
