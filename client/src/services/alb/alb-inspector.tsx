import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { ServiceInspectorProps } from '../types';
import type { AlbConfig } from './types';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const albConfigSchema = z.object({
  loadBalancerName: z.string().min(1, 'Load Balancer Name is required.'),
  scheme: z.enum(['internet-facing', 'internal']),
  lbType: z.enum(['application', 'network']),
});

export function AlbInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<AlbConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<AlbConfig>({
    resolver: zodResolver(albConfigSchema),
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
      <InspectorSection title="Load Balancer Configuration">
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
          <Select {...register('scheme')}>
            <option value="internet-facing">Internet-Facing</option>
            <option value="internal">Internal</option>
          </Select>
        </InspectorField>

        <InspectorField label="Type" error={errors.lbType?.message}>
          <Select {...register('lbType')}>
            <option value="application">Application</option>
            <option value="network">Network</option>
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
