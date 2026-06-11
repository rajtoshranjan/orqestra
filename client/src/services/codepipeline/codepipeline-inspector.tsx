import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { CodePipelineConfig } from './types';
import { codepipelineConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function CodePipelineInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<CodePipelineConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<CodePipelineConfig>({
    resolver: zodResolver(codepipelineConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activePipelineName = config.pipelineName;
  React.useEffect(() => {
    reset(config);
  }, [activePipelineName, reset]);

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
      <InspectorSection title="CodePipeline Configuration">
        <InspectorField
          label="Pipeline Name"
          error={errors.pipelineName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('pipelineName')}
          />
        </InspectorField>

        <InspectorField
          label="Pipeline Type"
          error={errors.pipelineType?.message}
        >
          <Select {...register('pipelineType')}>
            <option value="V2">V2</option>
            <option value="V1">V1</option>
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
