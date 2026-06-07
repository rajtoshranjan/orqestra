import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { KinesisConfig } from './types';
import { kinesisConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function KinesisInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<KinesisConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<KinesisConfig>({
    resolver: zodResolver(kinesisConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeStreamName = config.streamName;
  React.useEffect(() => {
    reset(config);
  }, [activeStreamName, reset]);

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
      <InspectorSection title="Kinesis Stream Configuration">
        <InspectorField label="Stream Name" error={errors.streamName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('streamName')}
          />
        </InspectorField>

        <InspectorField label="Shard Count" error={errors.shardCount?.message}>
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('shardCount', { valueAsNumber: true })}
          />
        </InspectorField>

        <InspectorField
          label="Data Retention (hours)"
          error={errors.retentionPeriod?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('retentionPeriod', { valueAsNumber: true })}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
