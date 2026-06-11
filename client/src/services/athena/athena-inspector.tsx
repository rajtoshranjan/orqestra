import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { AthenaConfig, AthenaEngineVersion } from './types';
import { athenaConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const ENGINE_VERSION_OPTIONS: Array<{
  value: AthenaEngineVersion;
  label: string;
}> = [
  { value: 'AUTO', label: 'Automatic' },
  { value: 'Athena engine version 3', label: 'Engine version 3' },
];

export function AthenaInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<AthenaConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<AthenaConfig>({
    resolver: zodResolver(athenaConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeWorkGroupName = config.workGroupName;
  React.useEffect(() => {
    reset(config);
  }, [activeWorkGroupName, reset]);

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
      <InspectorSection title="Athena Configuration">
        <InspectorField
          label="Workgroup Name"
          error={errors.workGroupName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('workGroupName')}
          />
        </InspectorField>

        <InspectorField
          label="Output Location"
          error={errors.outputLocation?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('outputLocation')}
          />
        </InspectorField>

        <InspectorField
          label="Engine Version"
          error={errors.engineVersion?.message}
        >
          <Select {...register('engineVersion')}>
            {ENGINE_VERSION_OPTIONS.map((option) => (
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
