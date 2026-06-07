import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { FSxConfig } from './types';
import { fsxConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const FILE_SYSTEM_TYPE_OPTIONS: Array<{ value: FSxConfig['fileSystemType']; label: string }> = [
  { value: 'LUSTRE', label: 'Lustre (HPC / ML)' },
  { value: 'WINDOWS', label: 'Windows (SMB)' },
  { value: 'NETAPP_ONTAP', label: 'NetApp ONTAP' },
  { value: 'OPENZFS', label: 'OpenZFS' },
];

export function FSxInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<FSxConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<FSxConfig>({
    resolver: zodResolver(fsxConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeFileSystemName = config.fileSystemName;
  React.useEffect(() => {
    reset(config);
  }, [activeFileSystemName, reset]);

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
      <InspectorSection title="FSx Configuration">
        <InspectorField
          label="File System Name"
          error={errors.fileSystemName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('fileSystemName')}
          />
        </InspectorField>

        <InspectorField
          label="File System Type"
          error={errors.fileSystemType?.message}
        >
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('fileSystemType')}
          >
            {FILE_SYSTEM_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </InspectorField>

        <InspectorField
          label="Storage Capacity (GiB)"
          error={errors.storageCapacityGb?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('storageCapacityGb', { valueAsNumber: true })}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
