import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { EventBridgeConfig } from './types';
import { eventbridgeConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import {
  InspectorSection,
  InspectorField,
  CodeEditorField,
} from '@/components';

export function EventBridgeInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<EventBridgeConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<EventBridgeConfig>({
    resolver: zodResolver(eventbridgeConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeRuleName = config.ruleName;
  React.useEffect(() => {
    reset(config);
  }, [activeRuleName, reset]);

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
      <InspectorSection title="EventBridge Rule Configuration">
        <InspectorField label="Rule Name" error={errors.ruleName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('ruleName')}
          />
        </InspectorField>

        <InspectorField
          label="Schedule Expression (e.g. rate(5 minutes) or cron(0 20 * * ? *))"
          error={errors.scheduleExpression?.message}
          optional
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('scheduleExpression')}
          />
        </InspectorField>
      </InspectorSection>

      <CodeEditorField
        label="Event Pattern (JSON)"
        error={errors.eventPattern?.message}
        value={watchedValues.eventPattern || ''}
        registerProps={register('eventPattern')}
      />
    </div>
  );
}
