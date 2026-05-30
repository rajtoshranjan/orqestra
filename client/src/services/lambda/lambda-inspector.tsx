import React from 'react';
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
import { Input } from '@/components/ui';
import {
  InspectorSection,
  InspectorField,
  CodeEditorField,
  KeyValueEditor,
} from '@/components';

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
    <div className="animate-fade-in space-y-6">
      {/* Configuration Section. */}
      <InspectorSection title="Configuration">
        {/* Function Name. */}
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

        {/* Runtime. */}
        <InspectorField label="Runtime" error={errors.runtime?.message}>
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
        </InspectorField>

        {/* Handler. */}
        <InspectorField label="Handler" error={errors.handler?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('handler')}
          />
        </InspectorField>

        {/* Memory Size. */}
        <InspectorField label="Memory (MB)" error={errors.memorySize?.message}>
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            min={128}
            max={10240}
            {...register('memorySize', { valueAsNumber: true })}
          />
        </InspectorField>

        {/* Timeout. */}
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

        {/* Description. */}
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
      </InspectorSection>

      {/* Function Code Section. */}
      <CodeEditorField
        label="Function Code"
        error={errors.code?.message}
        value={watchedValues.code}
        registerProps={register('code')}
      />

      {/* Environment Variables Section. */}
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
    </div>
  );
}
