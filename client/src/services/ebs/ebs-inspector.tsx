import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { EBSConfig } from './types';
import { ebsConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const VOLUME_TYPE_OPTIONS: Array<{ value: EBSConfig['volumeType']; label: string }> = [
  { value: 'gp3', label: 'gp3 (General Purpose SSD)' },
  { value: 'gp2', label: 'gp2 (General Purpose SSD, legacy)' },
  { value: 'io1', label: 'io1 (Provisioned IOPS SSD)' },
  { value: 'io2', label: 'io2 (Provisioned IOPS SSD, latest)' },
  { value: 'st1', label: 'st1 (Throughput Optimized HDD)' },
  { value: 'sc1', label: 'sc1 (Cold HDD)' },
];

export function EBSInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<EBSConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<EBSConfig>({
    resolver: zodResolver(ebsConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeVolumeName = config.volumeName;
  React.useEffect(() => {
    reset(config);
  }, [activeVolumeName, reset]);

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
      <InspectorSection title="EBS Configuration">
        <InspectorField label="Volume Name" error={errors.volumeName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('volumeName')}
          />
        </InspectorField>

        <InspectorField label="Volume Type" error={errors.volumeType?.message}>
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('volumeType')}
          >
            {VOLUME_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </InspectorField>

        <InspectorField label="Size (GiB)" error={errors.sizeGb?.message}>
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('sizeGb', { valueAsNumber: true })}
          />
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('encrypted')}
            />
            <span>Enable Encryption</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
