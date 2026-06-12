import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';
import { transitGatewayConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { TransitGatewayConfig } from './types';

export function TransitGatewayInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<TransitGatewayConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransitGatewayConfig>({
    resolver: zodResolver(transitGatewayConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeGatewayName = config.transitGatewayName;
  React.useEffect(() => {
    reset(config);
  }, [activeGatewayName, reset]);

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
      <InspectorSection title="Transit Gateway Configuration">
        <InspectorField
          label="Gateway Name"
          error={errors.transitGatewayName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('transitGatewayName')}
          />
        </InspectorField>

        <InspectorField
          label="Amazon Side ASN"
          error={errors.amazonSideAsn?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('amazonSideAsn', { valueAsNumber: true })}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
