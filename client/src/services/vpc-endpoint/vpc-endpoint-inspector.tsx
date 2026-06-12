import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input, Select } from '@/components/ui';
import { vpcEndpointConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { VpcEndpointConfig, VpcEndpointType } from './types';

const ENDPOINT_TYPE_OPTIONS: Array<{
  value: VpcEndpointType;
  label: string;
}> = [
  { value: 'Interface', label: 'Interface' },
  { value: 'Gateway', label: 'Gateway' },
  { value: 'GatewayLoadBalancer', label: 'Gateway Load Balancer' },
];

export function VpcEndpointInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<VpcEndpointConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<VpcEndpointConfig>({
    resolver: zodResolver(vpcEndpointConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeEndpointName = config.endpointName;
  React.useEffect(() => {
    reset(config);
  }, [activeEndpointName, reset]);

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
      <InspectorSection title="VPC Endpoint Configuration">
        <InspectorField
          label="Endpoint Name"
          error={errors.endpointName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('endpointName')}
          />
        </InspectorField>

        <InspectorField
          label="Endpoint Type"
          error={errors.endpointType?.message}
        >
          <Select {...register('endpointType')}>
            {ENDPOINT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </InspectorField>

        <InspectorField
          label="Service Name"
          error={errors.serviceName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('serviceName')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
