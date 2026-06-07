import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { BatchConfig } from './types';
import { batchConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function BatchInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<BatchConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<BatchConfig>({
    resolver: zodResolver(batchConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeEnvName = config.computeEnvironmentName;
  React.useEffect(() => {
    reset(config);
  }, [activeEnvName, reset]);

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
      <InspectorSection title="Batch Configuration">
        <InspectorField
          label="Compute Environment Name"
          error={errors.computeEnvironmentName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('computeEnvironmentName')}
          />
        </InspectorField>

        <InspectorField
          label="Compute Type"
          error={errors.computeType?.message}
        >
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('computeType')}
          >
            <option value="FARGATE">Fargate</option>
            <option value="EC2">EC2</option>
            <option value="SPOT">Spot</option>
          </select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
