import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { SNSConfig } from './types';
import { snsConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function SNSInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<SNSConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<SNSConfig>({
    resolver: zodResolver(snsConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeTopicName = config.topicName;
  React.useEffect(() => {
    reset(config);
  }, [activeTopicName, reset]);

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
      <InspectorSection title="SNS Configuration">
        <InspectorField label="Topic Name" error={errors.topicName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('topicName')}
          />
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('fifoTopic')}
            />
            <span>Enable FIFO Topic</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
