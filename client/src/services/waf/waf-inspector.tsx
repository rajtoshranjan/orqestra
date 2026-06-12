import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input, Select } from '@/components/ui';
import { wafConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { WafConfig, WafDefaultAction, WafScope } from './types';

const SCOPE_OPTIONS: Array<{ value: WafScope; label: string }> = [
  { value: 'REGIONAL', label: 'Regional' },
  { value: 'CLOUDFRONT', label: 'CloudFront' },
];

const DEFAULT_ACTION_OPTIONS: Array<{
  value: WafDefaultAction;
  label: string;
}> = [
  { value: 'ALLOW', label: 'Allow' },
  { value: 'BLOCK', label: 'Block' },
];

export function WafInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<WafConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<WafConfig>({
    resolver: zodResolver(wafConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeWebAclName = config.webAclName;
  React.useEffect(() => {
    reset(config);
  }, [activeWebAclName, reset]);

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
      <InspectorSection title="WAF Configuration">
        <InspectorField label="Web ACL Name" error={errors.webAclName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('webAclName')}
          />
        </InspectorField>

        <InspectorField label="Scope" error={errors.scope?.message}>
          <Select {...register('scope')}>
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </InspectorField>

        <InspectorField
          label="Default Action"
          error={errors.defaultAction?.message}
        >
          <Select {...register('defaultAction')}>
            {DEFAULT_ACTION_OPTIONS.map((option) => (
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
