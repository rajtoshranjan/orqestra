import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { AppGroupConfig } from './types';
import { appGroupConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function AppGroupInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<AppGroupConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<AppGroupConfig>({
    resolver: zodResolver(appGroupConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeGroupName = config.groupName;
  React.useEffect(() => {
    reset(config);
  }, [activeGroupName, reset]);

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
      <InspectorSection title="App Group Configuration">
        <InspectorField label="Group Name" error={errors.groupName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="app-group-1"
            {...register('groupName')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
