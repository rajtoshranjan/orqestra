import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { InspectorSection, InspectorField } from '@/components';
import { Input, Select } from '@/components/ui';

import type { ServiceInspectorProps } from '../types';
import type { NatGatewayConfig } from './types';

const natGatewayConfigSchema = z.object({
  natGatewayName: z.string().min(1, 'NAT Gateway Name is required.'),
  connectivityType: z.enum(['public', 'private']),
});

export function NatGatewayInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<NatGatewayConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<NatGatewayConfig>({
    resolver: zodResolver(natGatewayConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeNatGatewayName = config.natGatewayName;
  React.useEffect(() => {
    reset(config);
  }, [activeNatGatewayName, reset]);

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
      <InspectorSection title="NAT Gateway Configuration">
        <InspectorField
          label="NAT Gateway Name"
          error={errors.natGatewayName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('natGatewayName')}
          />
        </InspectorField>

        <InspectorField
          label="Connectivity Type"
          error={errors.connectivityType?.message}
        >
          <Select {...register('connectivityType')}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
