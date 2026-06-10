import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { CodeBuildConfig } from './types';
import { codebuildConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function CodeBuildInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<CodeBuildConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<CodeBuildConfig>({
    resolver: zodResolver(codebuildConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeProjectName = config.projectName;
  React.useEffect(() => {
    reset(config);
  }, [activeProjectName, reset]);

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
      <InspectorSection title="CodeBuild Configuration">
        <InspectorField
          label="Project Name"
          error={errors.projectName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('projectName')}
          />
        </InspectorField>

        <InspectorField label="Build Image" error={errors.buildImage?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('buildImage')}
          />
        </InspectorField>

        <InspectorField
          label="Compute Type"
          error={errors.computeType?.message}
        >
          <Select
            {...register('computeType')}
          >
            <option value="BUILD_GENERAL1_SMALL">Small</option>
            <option value="BUILD_GENERAL1_MEDIUM">Medium</option>
            <option value="BUILD_GENERAL1_LARGE">Large</option>
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
