import React from 'react';
import { useForm } from 'react-hook-form';
import type { ServiceInspectorProps } from '../types';
import type { SecretsManagerConfig } from './types';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function SecretsManagerInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<SecretsManagerConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<SecretsManagerConfig>({
    defaultValues: config,
    mode: 'all',
  });

  const activeSecretName = config.secretName;
  React.useEffect(() => {
    reset(config);
  }, [activeSecretName, reset]);

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
      <InspectorSection title="Secrets Manager Configuration">
        <InspectorField label="Secret Name" error={errors.secretName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('secretName', {
              required: 'Secret name is required.',
            })}
          />
        </InspectorField>

        <InspectorField label="Description" error={errors.description?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('description')}
          />
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('rotationEnabled')}
            />
            <span>Enable Secret Rotation</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
