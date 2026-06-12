import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';
import { regionConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { RegionConfig } from './types';

export function RegionInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<RegionConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<RegionConfig>({
    resolver: zodResolver(regionConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeRegionName = config.regionName;
  React.useEffect(() => {
    reset(config);
  }, [activeRegionName, reset]);

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
      <InspectorSection title="Region Configuration">
        <InspectorField label="Region Code" error={errors.regionName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="us-east-1"
            {...register('regionName')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
