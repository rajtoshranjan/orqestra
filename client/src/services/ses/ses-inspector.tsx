import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input, Select } from '@/components/ui';
import { sesConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { SesConfig, SesIdentityType } from './types';

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
          <Select {...register('identityType')}>
            {IDENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
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
