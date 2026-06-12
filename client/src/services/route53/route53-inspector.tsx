import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input, Select } from '@/components/ui';
import { route53ConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { Route53Config } from './types';

export function Route53Inspector({
  config,
  onUpdate,
}: ServiceInspectorProps<Route53Config>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<Route53Config>({
    resolver: zodResolver(route53ConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeZoneName = config.hostedZoneName;
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
      <InspectorSection title="Route 53 Configuration">
        <InspectorField
          label="Hosted Zone Name"
          error={errors.hostedZoneName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('hostedZoneName')}
          />
        </InspectorField>

        <InspectorField label="Zone Type" error={errors.zoneType?.message}>
          <Select {...register('zoneType')}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
