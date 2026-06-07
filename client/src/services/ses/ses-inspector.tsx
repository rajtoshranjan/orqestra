import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { SesConfig, SesIdentityType } from './types';
import { sesConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const IDENTITY_TYPE_OPTIONS: Array<{
  value: SesIdentityType;
  label: string;
}> = [
  { value: 'Domain', label: 'Domain' },
  { value: 'EmailAddress', label: 'Email address' },
];

export function SesInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<SesConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<SesConfig>({
    resolver: zodResolver(sesConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeIdentityName = config.identityName;
  React.useEffect(() => {
    reset(config);
  }, [activeIdentityName, reset]);

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
      <InspectorSection title="SES Configuration">
        <InspectorField
          label="Identity Name"
          error={errors.identityName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('identityName')}
          />
        </InspectorField>

        <InspectorField
          label="Identity Type"
          error={errors.identityType?.message}
        >
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('identityType')}
          >
            {IDENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </InspectorField>

        <InspectorField
          label="MAIL FROM Domain"
          error={errors.mailFromDomain?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('mailFromDomain')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
