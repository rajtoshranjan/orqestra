import React from 'react';

import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input, Select } from '@/components/ui';

import type { ServiceInspectorProps } from '../types';
import type { CognitoConfig, CognitoMFAConfiguration } from './types';

const MFA_OPTIONS: Array<{ value: CognitoMFAConfiguration; label: string }> = [
  { value: 'OFF', label: 'Off' },
  { value: 'OPTIONAL', label: 'Optional' },
  { value: 'ON', label: 'Required' },
];

export function CognitoInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<CognitoConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<CognitoConfig>({
    defaultValues: config,
    mode: 'all',
  });

  const activeUserPoolName = config.userPoolName;
  React.useEffect(() => {
    reset(config);
  }, [activeUserPoolName, reset]);

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
      <InspectorSection title="Cognito Configuration">
        <InspectorField
          label="User Pool Name"
          error={errors.userPoolName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('userPoolName', {
              required: 'User pool name is required.',
            })}
          />
        </InspectorField>

        <InspectorField
          label="MFA Configuration"
          error={errors.mfaConfiguration?.message}
        >
          <Select {...register('mfaConfiguration')}>
            {MFA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('selfSignUpEnabled')}
            />
            <span>Allow Self Sign-Up</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
