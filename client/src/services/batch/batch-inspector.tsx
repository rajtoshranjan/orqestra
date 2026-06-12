import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input, Select } from '@/components/ui';
import { batchConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { BatchConfig } from './types';

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
          <Select {...register('computeType')}>
            <option value="FARGATE">Fargate</option>
            <option value="EC2">EC2</option>
            <option value="SPOT">Spot</option>
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
