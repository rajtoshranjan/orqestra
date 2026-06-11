import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { AcmConfig, AcmValidationMethod } from './types';
import { acmConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const VALIDATION_METHOD_OPTIONS: Array<{
  value: AcmValidationMethod;
  label: string;
}> = [
  { value: 'DNS', label: 'DNS' },
  { value: 'EMAIL', label: 'Email' },
];

export function AcmInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<AcmConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<AcmConfig>({
    resolver: zodResolver(acmConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeCertificateName = config.certificateName;
  React.useEffect(() => {
    reset(config);
  }, [activeCertificateName, reset]);

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
      <InspectorSection title="ACM Certificate Configuration">
        <InspectorField
          label="Certificate Name"
          error={errors.certificateName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('certificateName')}
          />
        </InspectorField>

        <InspectorField label="Domain Name" error={errors.domainName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('domainName')}
          />
        </InspectorField>

        <InspectorField
          label="Validation Method"
          error={errors.validationMethod?.message}
        >
          <Select {...register('validationMethod')}>
            {VALIDATION_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
