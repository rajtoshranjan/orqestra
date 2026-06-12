import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';
import { mskConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { MskConfig } from './types';

export function MskInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<MskConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<MskConfig>({
    resolver: zodResolver(mskConfigSchema),
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
      <InspectorSection title="MSK Configuration">
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
          label="Kafka Version"
          error={errors.kafkaVersion?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('kafkaVersion')}
          />
        </InspectorField>

        <InspectorField
          label="Broker Instance Type"
          error={errors.brokerInstanceType?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('brokerInstanceType')}
          />
        </InspectorField>

        <InspectorField
          label="Broker Count"
          error={errors.brokerCount?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('brokerCount', { valueAsNumber: true })}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
