import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';
import { sharedServicesConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { SharedServicesConfig } from './types';

export function SharedServicesInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<SharedServicesConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<SharedServicesConfig>({
    resolver: zodResolver(sharedServicesConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeServicesName = config.servicesName;
  React.useEffect(() => {
    reset(config);
  }, [activeServicesName, reset]);

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
      <InspectorSection title="Shared Services Configuration">
        <InspectorField
          label="Boundary Name"
          error={errors.servicesName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="shared-services-1"
            {...register('servicesName')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
