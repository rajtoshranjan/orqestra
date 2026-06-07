import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { NlbConfig, NlbIpAddressType, NlbScheme } from './types';
import { nlbConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const SCHEME_OPTIONS: Array<{ value: NlbScheme; label: string }> = [
  { value: 'internal', label: 'Internal' },
  { value: 'internet-facing', label: 'Internet-facing' },
];

const IP_ADDRESS_TYPE_OPTIONS: Array<{
  value: NlbIpAddressType;
  label: string;
}> = [
  { value: 'ipv4', label: 'IPv4' },
  { value: 'dualstack', label: 'Dual-stack' },
];

export function NlbInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<NlbConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<NlbConfig>({
    resolver: zodResolver(nlbConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeLoadBalancerName = config.loadBalancerName;
  React.useEffect(() => {
    reset(config);
  }, [activeLoadBalancerName, reset]);

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
      <InspectorSection title="NLB Configuration">
        <InspectorField
          label="Load Balancer Name"
          error={errors.loadBalancerName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('loadBalancerName')}
          />
        </InspectorField>

        <InspectorField label="Scheme" error={errors.scheme?.message}>
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('scheme')}
          >
            {SCHEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </InspectorField>

        <InspectorField
          label="IP Address Type"
          error={errors.ipAddressType?.message}
        >
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('ipAddressType')}
          >
            {IP_ADDRESS_TYPE_OPTIONS.map((option) => (
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
