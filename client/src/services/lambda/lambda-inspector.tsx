import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { ServiceInspectorProps } from '../types';
import type { LambdaConfig, LambdaRuntime } from './types';
import { RUNTIME_OPTIONS } from './types';
import {
  getDefaultHandlerForRuntime,
  getDefaultCodeForRuntime,
  makeEnvironmentVariable,
} from './defaults';
import { lambdaConfigSchema } from '@/schemas/lambda.schema';
import { Button, Input } from '@/components/ui';

/* Shared sub-components. */

type SectionHeaderProps = {
  children: React.ReactNode;
};

function SectionHeader({ children }: SectionHeaderProps) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

type FieldErrorProps = {
  message?: string;
};

function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p className="animate-fade-in mt-1 text-xs text-destructive">{message}</p>
  );
}

function isLambdaRuntime(value: string): value is LambdaRuntime {
  return RUNTIME_OPTIONS.some((opt) => opt.value === value);
}

/* Lambda Inspector. */

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
    resolver: zodResolver(lambdaConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'environmentVariables',
  });

  // Track active config identity so we reset default values when user selects a different Lambda node.
  const activeFunctionName = config.functionName;
  React.useEffect(() => {
    reset(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFunctionName, reset]);

  // Watch form fields to trigger updates back to parent ReactFlow state on change.
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
    <div className="space-y-6">
      {/* Configuration Section. */}
      <section>
        <SectionHeader>Configuration</SectionHeader>
        <div className="space-y-4">
          {/* Function Name. */}
          <div>
            <label className="input-label">Function Name</label>
            <Input
              type="text"
              className="border-border/80 bg-background/50 text-foreground"
              {...register('functionName')}
            />
            <FieldError message={errors.functionName?.message} />
          </div>

          {/* Runtime. */}
          <div>
            <label className="input-label">Runtime</label>
            <select
              className="flex h-8 w-full rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              {...register('runtime')}
              onChange={(e) => {
                const val = e.target.value;
                if (isLambdaRuntime(val)) {
                  handleRuntimeChange(val);
                }
              }}
            >
              {RUNTIME_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-card text-foreground"
                >
                  {opt.label}
                </option>
              ))}
            </select>
            <FieldError message={errors.runtime?.message} />
          </div>

          {/* Handler. */}
          <div>
            <label className="input-label">Handler</label>
            <Input
              type="text"
              className="border-border/80 bg-background/50 text-foreground"
              {...register('handler')}
            />
            <FieldError message={errors.handler?.message} />
          </div>

          {/* Memory Size. */}
          <div>
            <label className="input-label">Memory (MB)</label>
            <Input
              type="number"
              className="border-border/80 bg-background/50 text-foreground"
              min={128}
              max={10240}
              {...register('memorySize', { valueAsNumber: true })}
            />
            <FieldError message={errors.memorySize?.message} />
          </div>

          {/* Timeout. */}
          <div>
            <label className="input-label">Timeout (seconds)</label>
            <Input
              type="number"
              className="border-border/80 bg-background/50 text-foreground"
              min={1}
              max={900}
              {...register('timeout', { valueAsNumber: true })}
            />
            <FieldError message={errors.timeout?.message} />
          </div>

          {/* Description. */}
          <div>
            <label className="input-label">Description</label>
            <Input
              type="text"
              className="border-border/80 bg-background/50 text-foreground"
              {...register('description')}
            />
            <FieldError message={errors.description?.message} />
          </div>
        </div>
      </section>

      {/* Function Code Section. */}
      <section>
        <SectionHeader>Function Code</SectionHeader>
        <div>
          <label className="input-label">Source</label>
          <textarea
            className="w-full resize-y rounded-md border border-border/80 bg-background/50 px-2.5 py-1.5 font-mono text-xs text-foreground shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            style={{
              minHeight: 200,
              fontFamily: "'JetBrains Mono', monospace",
            }}
            {...register('code')}
          />
          <div className="mt-1 flex items-center justify-between">
            <FieldError message={errors.code?.message} />
            <span className="ml-auto text-[10px] text-muted-foreground">
              {watchedValues.code?.length ?? 0} chars
            </span>
          </div>
        </div>
      </section>

      {/* Environment Variables Section. */}
      <section>
        <SectionHeader>Environment Variables</SectionHeader>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <Input
                type="text"
                className="border-border/80 bg-background/50 text-foreground"
                placeholder="KEY"
                {...register(`environmentVariables.${index}.key`)}
              />
              <Input
                type="text"
                className="border-border/80 bg-background/50 text-foreground"
                placeholder="Value"
                {...register(`environmentVariables.${index}.value`)}
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => remove(index)}
                className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove variable"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <FieldError message={getEnvVarErrorMessage()} />
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => append(makeEnvironmentVariable())}
            className="mt-1 flex items-center gap-1.5 text-primary hover:bg-accent/40"
          >
            <Plus className="size-3.5" />
            Add variable
          </Button>
        </div>
      </section>
    </div>
  );
}
