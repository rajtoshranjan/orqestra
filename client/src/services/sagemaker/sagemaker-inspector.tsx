import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { SageMakerConfig } from './types';
import { sagemakerConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function SageMakerInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<SageMakerConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<SageMakerConfig>({
    resolver: zodResolver(sagemakerConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeNotebookName = config.notebookName;
  React.useEffect(() => {
    reset(config);
  }, [activeNotebookName, reset]);

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
      <InspectorSection title="SageMaker Configuration">
        <InspectorField
          label="Notebook Name"
          error={errors.notebookName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('notebookName')}
          />
        </InspectorField>

        <InspectorField
          label="Instance Type"
          error={errors.instanceType?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('instanceType')}
          />
        </InspectorField>

        <InspectorField
          label="Volume Size (GiB)"
          error={errors.volumeSizeGb?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('volumeSizeGb', { valueAsNumber: true })}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
