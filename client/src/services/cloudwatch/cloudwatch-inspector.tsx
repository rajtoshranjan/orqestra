import React from 'react';

import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';

import type { ServiceInspectorProps } from '../types';
import type { CloudWatchConfig } from './types';

export function CloudWatchInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<CloudWatchConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<CloudWatchConfig>({
    defaultValues: config,
    mode: 'all',
  });

  const activeDashboardName = config.dashboardName;
  React.useEffect(() => {
    reset(config);
  }, [activeDashboardName, reset]);

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
      <InspectorSection title="CloudWatch Configuration">
        <InspectorField
          label="Dashboard Name"
          error={errors.dashboardName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('dashboardName', {
              required: 'Dashboard name is required.',
            })}
          />
        </InspectorField>

        <InspectorField
          label="Retention (days)"
          error={errors.retentionDays?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('retentionDays', { valueAsNumber: true })}
          />
        </InspectorField>

        <InspectorField
          label="Alarm Prefix"
          error={errors.alarmPrefix?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('alarmPrefix')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
