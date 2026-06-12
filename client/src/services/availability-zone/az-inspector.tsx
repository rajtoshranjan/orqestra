import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';
import { azConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { AZConfig } from './types';

export function AZInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<AZConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<AZConfig>({
    resolver: zodResolver(azConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeZoneName = config.zoneName;
  React.useEffect(() => {
    reset(config);
  }, [activeZoneName, reset]);

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
      <InspectorSection title="AZ Configuration">
        <InspectorField label="AZ Code" error={errors.zoneName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="us-east-1a"
            {...register('zoneName')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
