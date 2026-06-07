import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { XRayConfig } from './types';
import { xrayConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function XRayInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<XRayConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<XRayConfig>({
    resolver: zodResolver(xrayConfigSchema),
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
      <InspectorSection title="X-Ray Configuration">
        <InspectorField label="Group Name" error={errors.groupName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('groupName')}
          />
        </InspectorField>

        <InspectorField
          label="Sampling Rate (%)"
          error={errors.samplingRate?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('samplingRate', { valueAsNumber: true })}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
