import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { CodeDeployConfig } from './types';
import { codedeployConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function CodeDeployInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<CodeDeployConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<CodeDeployConfig>({
    resolver: zodResolver(codedeployConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeApplicationName = config.applicationName;
  React.useEffect(() => {
    reset(config);
  }, [activeApplicationName, reset]);

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
      <InspectorSection title="CodeDeploy Configuration">
        <InspectorField
          label="Application Name"
          error={errors.applicationName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('applicationName')}
          />
        </InspectorField>

        <InspectorField
          label="Compute Platform"
          error={errors.computePlatform?.message}
        >
          <Select
            {...register('computePlatform')}
          >
            <option value="ECS">ECS</option>
            <option value="Lambda">Lambda</option>
            <option value="Server">Server</option>
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
