import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';
import { redshiftConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { RedshiftConfig } from './types';

export function RedshiftInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<RedshiftConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<RedshiftConfig>({
    resolver: zodResolver(redshiftConfigSchema),
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
      <InspectorSection title="Redshift Configuration">
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

        <InspectorField label="Node Type" error={errors.nodeType?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="dc2.large"
            {...register('nodeType')}
          />
        </InspectorField>

        <InspectorField
          label="Number of Nodes"
          error={errors.numberOfNodes?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('numberOfNodes', { valueAsNumber: true })}
          />
        </InspectorField>

        <InspectorField
          label="Database Name"
          error={errors.databaseName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('databaseName')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
