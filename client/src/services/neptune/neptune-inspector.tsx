import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';
import { neptuneConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { NeptuneConfig } from './types';

export function NeptuneInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<NeptuneConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<NeptuneConfig>({
    resolver: zodResolver(neptuneConfigSchema),
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
      <InspectorSection title="Neptune Configuration">
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

        <InspectorField
          label="Engine Version"
          error={errors.engineVersion?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('engineVersion')}
          />
        </InspectorField>

        <InspectorField
          label="Instance Class"
          error={errors.instanceClass?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('instanceClass')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
