import React from 'react';
import { useForm } from 'react-hook-form';
import type { ServiceInspectorProps } from '../types';
import type { KMSConfig, KMSKeyUsage } from './types';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const KEY_USAGE_OPTIONS: Array<{ value: KMSKeyUsage; label: string }> = [
  { value: 'ENCRYPT_DECRYPT', label: 'Encrypt / Decrypt' },
  { value: 'SIGN_VERIFY', label: 'Sign / Verify' },
];

export function KMSInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<KMSConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<KMSConfig>({
    defaultValues: config,
    mode: 'all',
  });

  const activeKeyAlias = config.keyAlias;
  React.useEffect(() => {
    reset(config);
  }, [activeKeyAlias, reset]);

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
      <InspectorSection title="KMS Key Configuration">
        <InspectorField label="Key Alias" error={errors.keyAlias?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="alias/my-key"
            {...register('keyAlias', {
              required: 'Key alias is required.',
              validate: (value) =>
                value.startsWith('alias/') ||
                "Key alias must start with 'alias/'.",
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

        <InspectorField label="Key Usage" error={errors.keyUsage?.message}>
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('keyUsage')}
          >
            {KEY_USAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('multiRegion')}
            />
            <span>Enable Multi-Region Key</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
