import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { WafConfig, WafDefaultAction, WafScope } from './types';
import { wafConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

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
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('scope')}
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </InspectorField>

        <InspectorField
          label="Default Action"
          error={errors.defaultAction?.message}
        >
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('defaultAction')}
          >
            {DEFAULT_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
