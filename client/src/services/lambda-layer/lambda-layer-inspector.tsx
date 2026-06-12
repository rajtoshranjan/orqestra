import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';
import { lambdaLayerConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { LambdaLayerConfig } from './types';

const RUNTIME_ITEMS = ['nodejs20.x', 'nodejs22.x', 'python3.12'];
const ARCH_ITEMS = ['x86_64', 'arm64'];

export function LambdaLayerInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<LambdaLayerConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<LambdaLayerConfig>({
    resolver: zodResolver(lambdaLayerConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeLayerName = config.layerName;
  React.useEffect(() => {
    reset(config);
  }, [activeLayerName, reset]);

  const watchedValues = watch();
  const lastUpdatedRef = React.useRef<string>('');

  React.useEffect(() => {
    const serialized = JSON.stringify(watchedValues);
    if (serialized !== lastUpdatedRef.current) {
      lastUpdatedRef.current = serialized;
      onUpdate(() => watchedValues);
    }
  }, [watchedValues, onUpdate]);

  function handleRuntimeToggle(runtime: string) {
    const current = watchedValues.compatibleRuntimes || [];
    const next = current.includes(runtime)
      ? current.filter((r) => r !== runtime)
      : [...current, runtime];
    onUpdate((prev) => ({ ...prev, compatibleRuntimes: next }));
  }

  function handleArchToggle(arch: string) {
    const current = watchedValues.compatibleArchitectures || [];
    const next = current.includes(arch)
      ? current.filter((a) => a !== arch)
      : [...current, arch];
    onUpdate((prev) => ({ ...prev, compatibleArchitectures: next }));
  }

  return (
    <div className="animate-fade-in space-y-6">
      <InspectorSection title="Layer Configuration">
        <InspectorField label="Layer Name" error={errors.layerName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('layerName')}
          />
        </InspectorField>

        <InspectorField label="Description" error={errors.description?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('description')}
          />
        </InspectorField>
      </InspectorSection>

      <InspectorSection title="Compatible Runtimes">
        <div className="flex flex-col gap-2">
          {RUNTIME_ITEMS.map((runtime) => (
            <label
              key={runtime}
              className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground"
            >
              <input
                type="checkbox"
                checked={watchedValues.compatibleRuntimes?.includes(runtime)}
                onChange={() => handleRuntimeToggle(runtime)}
                className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              />
              <span>{runtime}</span>
            </label>
          ))}
        </div>
      </InspectorSection>

      <InspectorSection title="Compatible Architectures">
        <div className="flex flex-col gap-2">
          {ARCH_ITEMS.map((arch) => (
            <label
              key={arch}
              className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground"
            >
              <input
                type="checkbox"
                checked={watchedValues.compatibleArchitectures?.includes(arch)}
                onChange={() => handleArchToggle(arch)}
                className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              />
              <span>{arch}</span>
            </label>
          ))}
        </div>
      </InspectorSection>
    </div>
  );
}
