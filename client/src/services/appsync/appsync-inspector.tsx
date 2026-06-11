import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type {
  AppSyncApiType,
  AppSyncAuthenticationType,
  AppSyncConfig,
} from './types';
import { appsyncConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const AUTHENTICATION_TYPE_OPTIONS: Array<{
  value: AppSyncAuthenticationType;
  label: string;
}> = [
  { value: 'API_KEY', label: 'API Key' },
  { value: 'AWS_IAM', label: 'AWS IAM' },
  { value: 'AMAZON_COGNITO_USER_POOLS', label: 'Cognito User Pools' },
  { value: 'OPENID_CONNECT', label: 'OpenID Connect' },
  { value: 'AWS_LAMBDA', label: 'AWS Lambda' },
];

const API_TYPE_OPTIONS: Array<{ value: AppSyncApiType; label: string }> = [
  { value: 'GRAPHQL', label: 'GraphQL' },
  { value: 'MERGED', label: 'Merged API' },
];

export function AppSyncInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<AppSyncConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<AppSyncConfig>({
    resolver: zodResolver(appsyncConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeApiName = config.apiName;
  React.useEffect(() => {
    reset(config);
  }, [activeApiName, reset]);

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
      <InspectorSection title="AppSync Configuration">
        <InspectorField label="API Name" error={errors.apiName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('apiName')}
          />
        </InspectorField>

        <InspectorField label="API Type" error={errors.apiType?.message}>
          <Select {...register('apiType')}>
            {API_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </InspectorField>

        <InspectorField
          label="Authentication"
          error={errors.authenticationType?.message}
        >
          <Select {...register('authenticationType')}>
            {AUTHENTICATION_TYPE_OPTIONS.map((option) => (
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
