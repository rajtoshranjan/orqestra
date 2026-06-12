import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';

import {
  InspectorSection,
  InspectorField,
  CodeEditorField,
  KeyValueEditor,
} from '@/components';
import {
  Input,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui';
import { lambdaConfigSchema } from '@/schemas/lambda.schema';

import {
  getDefaultHandlerForRuntime,
  getDefaultCodeForRuntime,
  makeEnvironmentVariable,
} from './defaults';
import { RUNTIME_OPTIONS } from './types';

import type { ServiceInspectorProps } from '../types';
import type { LambdaConfig, LambdaRuntime } from './types';

function isLambdaRuntime(value: string): value is LambdaRuntime {
  return RUNTIME_OPTIONS.some((opt) => opt.value === value);
}

export function LambdaInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<LambdaConfig>) {
  const {
    register,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<LambdaConfig>({
    resolver: zodResolver(lambdaConfigSchema) as any,
    defaultValues: config,
    mode: 'all',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'environmentVariables',
  });

  const activeFunctionName = config.functionName;
  React.useEffect(() => {
    reset(config);
  }, [activeFunctionName, reset]);

  const watchedValues = watch();
  const lastUpdatedRef = React.useRef<string>('');

  React.useEffect(() => {
    const serialized = JSON.stringify(watchedValues);
    if (serialized !== lastUpdatedRef.current) {
      lastUpdatedRef.current = serialized;
      onUpdate(() => watchedValues);
    }
  }, [watchedValues, onUpdate]);

  const getEnvVarErrorMessage = (): string | undefined => {
    if (!errors.environmentVariables) return undefined;
    if (errors.environmentVariables.message) {
      return errors.environmentVariables.message;
    }
    const rootErr = Object(errors.environmentVariables).root;
    if (rootErr && typeof rootErr === 'object' && 'message' in rootErr) {
      return String(rootErr.message);
    }
    return undefined;
  };

  function handleRuntimeChange(runtime: LambdaRuntime) {
    setValue('runtime', runtime, { shouldValidate: true });
    setValue('handler', getDefaultHandlerForRuntime(runtime), {
      shouldValidate: true,
    });
    setValue('code', getDefaultCodeForRuntime(runtime), {
      shouldValidate: true,
    });
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* General Configuration */}
      <InspectorSection title="General Configuration">
        <InspectorField
          label="Function Name"
          error={errors.functionName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('functionName')}
          />
        </InspectorField>

        <InspectorField
          label="Description"
          error={errors.description?.message}
          optional
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('description')}
          />
        </InspectorField>

        <InspectorField
          label="Package Type"
          error={errors.packageType?.message}
        >
          <input type="hidden" {...register('packageType')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span>{watchedValues.packageType}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={watchedValues.packageType}
                onValueChange={(val) => {
                  setValue('packageType', val as 'Zip' | 'Image', {
                    shouldValidate: true,
                  });
                }}
              >
                <DropdownMenuRadioItem
                  value="Zip"
                  className="cursor-pointer text-xs"
                >
                  ZIP Archive
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="Image"
                  className="cursor-pointer text-xs"
                >
                  Container Image
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InspectorField>

        <InspectorField
          label="CPU Architecture"
          error={errors.architecture?.message}
        >
          <input type="hidden" {...register('architecture')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span>{watchedValues.architecture}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={watchedValues.architecture}
                onValueChange={(val) => {
                  setValue('architecture', val as 'x86_64' | 'arm64', {
                    shouldValidate: true,
                  });
                }}
              >
                <DropdownMenuRadioItem
                  value="x86_64"
                  className="cursor-pointer text-xs"
                >
                  x86_64 (Intel/AMD)
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="arm64"
                  className="cursor-pointer text-xs"
                >
                  arm64 (AWS Graviton2/3)
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InspectorField>
      </InspectorSection>

      {/* Package-specific settings */}
      {watchedValues.packageType === 'Zip' ? (
        <>
          <InspectorSection title="Runtime Code Configuration">
            <InspectorField label="Runtime" error={errors.runtime?.message}>
              <input type="hidden" {...register('runtime')} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
                  >
                    <span>
                      {RUNTIME_OPTIONS.find(
                        (opt) => opt.value === watchedValues.runtime,
                      )?.label ||
                        watchedValues.runtime ||
                        'Select runtime'}
                    </span>
                    <ChevronDown className="size-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-[300px] w-[200px] overflow-y-auto border-border bg-card">
                  <DropdownMenuRadioGroup
                    value={watchedValues.runtime}
                    onValueChange={(val) => {
                      if (isLambdaRuntime(val)) {
                        handleRuntimeChange(val);
                      }
                    }}
                  >
                    {RUNTIME_OPTIONS.map((opt) => (
                      <DropdownMenuRadioItem
                        key={opt.value}
                        value={opt.value}
                        className="cursor-pointer text-xs text-foreground"
                      >
                        {opt.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </InspectorField>

            <InspectorField label="Handler" error={errors.handler?.message}>
              <Input
                type="text"
                className="border-border/80 bg-background/50 text-foreground"
                {...register('handler')}
              />
            </InspectorField>
          </InspectorSection>

          <CodeEditorField
            label="Function Code"
            error={errors.code?.message}
            value={watchedValues.code || ''}
            registerProps={register('code')}
          />
        </>
      ) : (
        <div className="my-4 rounded-md border border-dashed border-border bg-muted/20 p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Container image configuration is derived automatically from the
            connected ECR Repository on the canvas.
          </p>
        </div>
      )}

      {/* Execution Limits & Performance */}
      <InspectorSection title="Memory, Timeout & Ephemeral Storage">
        <InspectorField label="Memory (MB)" error={errors.memorySize?.message}>
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            min={128}
            max={10240}
            {...register('memorySize', { valueAsNumber: true })}
          />
        </InspectorField>

        <InspectorField
          label="Timeout (seconds)"
          error={errors.timeout?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            min={1}
            max={900}
            {...register('timeout', { valueAsNumber: true })}
          />
        </InspectorField>

        <InspectorField
          label="Ephemeral Storage (MB)"
          error={errors.ephemeralStorage?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            min={512}
            max={10240}
            {...register('ephemeralStorage', { valueAsNumber: true })}
          />
        </InspectorField>
      </InspectorSection>

      {/* Concurrency & SnapStart */}
      <InspectorSection title="Concurrency & Performance Optimizations">
        <InspectorField
          label="Reserved Concurrency"
          error={errors.reservedConcurrency?.message}
          optional
        >
          <Input
            type="number"
            placeholder="No limit"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('reservedConcurrency', { valueAsNumber: true })}
          />
        </InspectorField>

        <InspectorField
          label="Provisioned Concurrency"
          error={errors.provisionedConcurrency?.message}
          optional
        >
          <Input
            type="number"
            placeholder="Off"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('provisionedConcurrency', { valueAsNumber: true })}
          />
        </InspectorField>

        <InspectorField
          label="Lambda SnapStart"
          error={errors.snapStart?.message}
        >
          <input type="hidden" {...register('snapStart')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span className="flex items-center gap-1">
                  {watchedValues.snapStart === 'PublishedVersions' && (
                    <Sparkles className="size-3 fill-warning/20 text-warning" />
                  )}
                  {watchedValues.snapStart === 'PublishedVersions'
                    ? 'PublishedVersions (Accelerated Cold Starts)'
                    : 'None'}
                </span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[250px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={watchedValues.snapStart}
                onValueChange={(val) => {
                  setValue('snapStart', val as 'None' | 'PublishedVersions', {
                    shouldValidate: true,
                  });
                }}
              >
                <DropdownMenuRadioItem
                  value="None"
                  className="cursor-pointer text-xs"
                >
                  None
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="PublishedVersions"
                  className="cursor-pointer text-xs"
                >
                  PublishedVersions (Requires Java runtime)
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InspectorField>
      </InspectorSection>

      {/* Function URLs */}
      <InspectorSection title="Function URLs (HTTPS Endpoint)">
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('enableFunctionUrl')}
            />
            <span>Enable HTTPS Function URL</span>
          </label>
        </div>

        {watchedValues.enableFunctionUrl && (
          <InspectorField
            label="Authentication Type"
            error={errors.functionUrlAuthType?.message}
            className="mt-3"
          >
            <input type="hidden" {...register('functionUrlAuthType')} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
                >
                  <span>{watchedValues.functionUrlAuthType}</span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px] border-border bg-card">
                <DropdownMenuRadioGroup
                  value={watchedValues.functionUrlAuthType}
                  onValueChange={(val) =>
                    setValue('functionUrlAuthType', val as 'NONE' | 'AWS_IAM', {
                      shouldValidate: true,
                    })
                  }
                >
                  <DropdownMenuRadioItem
                    value="NONE"
                    className="cursor-pointer text-xs text-destructive"
                  >
                    NONE (Public unauthenticated)
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="AWS_IAM"
                    className="cursor-pointer text-xs"
                  >
                    AWS_IAM (Signature V4 required)
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </InspectorField>
        )}
      </InspectorSection>

      {/* Environment Variables */}
      <KeyValueEditor<LambdaConfig>
        title="Environment Variables"
        fields={fields}
        register={register}
        remove={remove}
        append={append}
        namePrefix="environmentVariables"
        error={getEnvVarErrorMessage()}
        makeEmptyValue={makeEnvironmentVariable}
      />

      {/* Monitoring & Tracing */}
      <InspectorSection title="Monitoring & Observability">
        <InspectorField
          label="CloudWatch Logs Retention (days)"
          error={errors.logRetention?.message}
        >
          <input type="hidden" {...register('logRetention')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span>{watchedValues.logRetention} days</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={String(watchedValues.logRetention)}
                onValueChange={(val) =>
                  setValue('logRetention', Number(val), {
                    shouldValidate: true,
                  })
                }
              >
                {[1, 3, 5, 7, 14, 30, 60, 90, 180, 365].map((d) => (
                  <DropdownMenuRadioItem
                    key={d}
                    value={String(d)}
                    className="cursor-pointer text-xs"
                  >
                    {d} days
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InspectorField>

        <InspectorField
          label="X-Ray Tracing Mode"
          error={errors.tracingMode?.message}
        >
          <input type="hidden" {...register('tracingMode')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span>{watchedValues.tracingMode}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={watchedValues.tracingMode}
                onValueChange={(val) =>
                  setValue('tracingMode', val as 'Active' | 'PassThrough', {
                    shouldValidate: true,
                  })
                }
              >
                <DropdownMenuRadioItem
                  value="PassThrough"
                  className="cursor-pointer text-xs"
                >
                  PassThrough (Trace requests only if caller is traced)
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="Active"
                  className="cursor-pointer text-xs"
                >
                  Active (Automatically trace all requests)
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('lambdaInsights')}
            />
            <span>Enable CloudWatch Lambda Insights</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
