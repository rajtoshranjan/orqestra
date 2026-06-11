import React from 'react';
import { useForm } from 'react-hook-form';
import type { ServiceInspectorProps } from '../types';
import type { RDSConfig, RDSEngine } from './types';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const ENGINE_OPTIONS: Array<{ value: RDSEngine; label: string }> = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'aurora-mysql', label: 'Aurora MySQL' },
  { value: 'aurora-postgres', label: 'Aurora PostgreSQL' },
  { value: 'oracle-se2', label: 'Oracle SE2' },
];

export function RDSInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<RDSConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<RDSConfig>({
    defaultValues: config,
    mode: 'all',
  });

  const activeInstanceIdentifier = config.instanceIdentifier;
  React.useEffect(() => {
    reset(config);
  }, [activeInstanceIdentifier, reset]);

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
      <InspectorSection title="RDS Configuration">
        <InspectorField
          label="Instance Identifier"
          error={errors.instanceIdentifier?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('instanceIdentifier', {
              required: 'Instance identifier is required.',
            })}
          />
        </InspectorField>

        <InspectorField label="Engine" error={errors.engine?.message}>
          <Select {...register('engine')}>
            {ENGINE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </InspectorField>

        <InspectorField
          label="Instance Class"
          error={errors.instanceClass?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('instanceClass', {
              required: 'Instance class is required.',
            })}
          />
        </InspectorField>

        <InspectorField
          label="Allocated Storage (GB)"
          error={errors.allocatedStorage?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('allocatedStorage', {
              valueAsNumber: true,
              min: {
                value: 20,
                message: 'Allocated storage must be at least 20 GB.',
              },
            })}
          />
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('multiAz')}
            />
            <span>Enable Multi-AZ Deployment</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
