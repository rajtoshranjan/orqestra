import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input, Select } from '@/components/ui';
import { cloudtrailConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { CloudTrailConfig, CloudTrailManagementEvents } from './types';

const MANAGEMENT_EVENTS_OPTIONS: Array<{
  value: CloudTrailManagementEvents;
  label: string;
}> = [
  { value: 'All', label: 'All management events' },
  { value: 'ReadOnly', label: 'Read-only events' },
  { value: 'WriteOnly', label: 'Write-only events' },
];

export function CloudTrailInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<CloudTrailConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<CloudTrailConfig>({
    resolver: zodResolver(cloudtrailConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeTrailName = config.trailName;
  React.useEffect(() => {
    reset(config);
  }, [activeTrailName, reset]);

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
      <InspectorSection title="CloudTrail Configuration">
        <InspectorField label="Trail Name" error={errors.trailName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('trailName')}
          />
        </InspectorField>

        <InspectorField
          label="Destination Bucket"
          error={errors.destinationBucketName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('destinationBucketName')}
          />
        </InspectorField>

        <InspectorField
          label="Management Events"
          error={errors.managementEvents?.message}
        >
          <Select {...register('managementEvents')}>
            {MANAGEMENT_EVENTS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
