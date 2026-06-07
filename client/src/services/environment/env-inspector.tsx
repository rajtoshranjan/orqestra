import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { EnvironmentConfig } from './types';
import { environmentConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function EnvInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<EnvironmentConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<EnvironmentConfig>({
    resolver: zodResolver(environmentConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeEnvName = config.envName;
  React.useEffect(() => {
    reset(config);
  }, [activeEnvName, reset]);

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
      <InspectorSection title="Environment Configuration">
        <InspectorField
          label="Environment Name"
          error={errors.envName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="dev"
            {...register('envName')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
