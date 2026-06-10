import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { SsmConfig, SsmParameterTier, SsmParameterType } from './types';
import { ssmConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const PARAMETER_TYPE_OPTIONS: Array<{
  value: SsmParameterType;
  label: string;
}> = [
  { value: 'String', label: 'String' },
  { value: 'StringList', label: 'String List' },
  { value: 'SecureString', label: 'Secure String' },
];

const TIER_OPTIONS: Array<{ value: SsmParameterTier; label: string }> = [
  { value: 'Standard', label: 'Standard' },
  { value: 'Advanced', label: 'Advanced' },
  { value: 'Intelligent-Tiering', label: 'Intelligent-Tiering' },
];

export function SsmInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<SsmConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<SsmConfig>({
    resolver: zodResolver(ssmConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeParameterName = config.parameterName;
  React.useEffect(() => {
    reset(config);
  }, [activeParameterName, reset]);

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
      <InspectorSection title="SSM Parameter Configuration">
        <InspectorField
          label="Parameter Name"
          error={errors.parameterName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('parameterName')}
          />
        </InspectorField>

        <InspectorField
          label="Parameter Type"
          error={errors.parameterType?.message}
        >
          <Select
            {...register('parameterType')}
          >
            {PARAMETER_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </InspectorField>

        <InspectorField label="Tier" error={errors.tier?.message}>
          <Select
            {...register('tier')}
          >
            {TIER_OPTIONS.map((option) => (
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
