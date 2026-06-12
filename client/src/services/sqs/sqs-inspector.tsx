import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';
import { sqsConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { SQSConfig } from './types';

export function SQSInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<SQSConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<SQSConfig>({
    resolver: zodResolver(sqsConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeQueueName = config.queueName;
  React.useEffect(() => {
    reset(config);
  }, [activeQueueName, reset]);

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
      <InspectorSection title="SQS Configuration">
        <InspectorField label="Queue Name" error={errors.queueName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('queueName')}
          />
        </InspectorField>

        <InspectorField
          label="Visibility Timeout (seconds)"
          error={errors.visibilityTimeoutSeconds?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('visibilityTimeoutSeconds', { valueAsNumber: true })}
          />
        </InspectorField>

        <InspectorField
          label="Message Retention (seconds)"
          error={errors.messageRetentionSeconds?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('messageRetentionSeconds', { valueAsNumber: true })}
          />
        </InspectorField>

        <InspectorField
          label="Delay (seconds)"
          error={errors.delaySeconds?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('delaySeconds', { valueAsNumber: true })}
          />
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('fifoQueue')}
            />
            <span>Enable FIFO Queue (Exactly-Once Processing)</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
