import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input, Select } from '@/components/ui';
import { ecsClusterConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { EcsClusterConfig } from './types';

export function EcsClusterInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<EcsClusterConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<EcsClusterConfig>({
    resolver: zodResolver(ecsClusterConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeClusterName = config.clusterName;
  React.useEffect(() => {
    reset(config);
  }, [activeClusterName, reset]);

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
      <InspectorSection title="ECS Cluster Configuration">
        <InspectorField
          label="Cluster Name"
          error={errors.clusterName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('clusterName')}
          />
        </InspectorField>

        <InspectorField label="Launch Type" error={errors.launchType?.message}>
          <Select {...register('launchType')}>
            <option value="FARGATE">Fargate</option>
            <option value="EC2">EC2</option>
            <option value="EXTERNAL">External</option>
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
