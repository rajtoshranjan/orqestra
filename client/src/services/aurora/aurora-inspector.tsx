import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { AuroraConfig } from './types';
import { auroraConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const ENGINE_OPTIONS: Array<{ value: AuroraConfig['engine']; label: string }> =
  [
    { value: 'aurora-postgresql', label: 'Aurora PostgreSQL' },
    { value: 'aurora-mysql', label: 'Aurora MySQL' },
  ];

export function AuroraInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<AuroraConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<AuroraConfig>({
    resolver: zodResolver(auroraConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeClusterIdentifier = config.clusterIdentifier;
  React.useEffect(() => {
    reset(config);
  }, [activeClusterIdentifier, reset]);

  const watchedValues = watch();
  const lastUpdatedRef = React.useRef<string>('');

  React.useEffect(() => {
    const serialized = JSON.stringify(watchedValues);
    if (serialized !== lastUpdatedRef.current) {
      lastUpdatedRef.current = serialized;
      onUpdate(() => watchedValues);
    }
  }, [watchedValues, onUpdate]);

  return (
    <div className="animate-fade-in space-y-6">
      <InspectorSection title="Aurora Configuration">
        <InspectorField
          label="Cluster Identifier"
          error={errors.clusterIdentifier?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('clusterIdentifier')}
          />
        </InspectorField>

        <InspectorField label="Engine" error={errors.engine?.message}>
          <Select
            {...register('engine')}
          >
            {ENGINE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </InspectorField>

        <InspectorField
          label="Engine Version"
          error={errors.engineVersion?.message}
          optional
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="15.4"
            {...register('engineVersion')}
          />
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('serverless')}
            />
            <span>Enable Serverless (Aurora Serverless v2)</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
