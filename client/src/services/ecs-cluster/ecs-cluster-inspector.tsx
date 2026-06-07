import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { EcsClusterConfig } from './types';
import { ecsClusterConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

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

        <InspectorField
          label="Launch Type"
          error={errors.launchType?.message}
        >
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('launchType')}
          >
            <option value="FARGATE">Fargate</option>
            <option value="EC2">EC2</option>
            <option value="EXTERNAL">External</option>
          </select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
