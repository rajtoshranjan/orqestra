import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { ServiceInspectorProps } from '../types';
import type { InternetGatewayConfig } from './types';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const internetGatewayConfigSchema = z.object({
  gatewayName: z.string().min(1, 'Gateway Name is required.'),
});

export function InternetGatewayInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<InternetGatewayConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<InternetGatewayConfig>({
    resolver: zodResolver(internetGatewayConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeGatewayName = config.gatewayName;
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
      <InspectorSection title="Internet Gateway Configuration">
        <InspectorField
          label="Gateway Name"
          error={errors.gatewayName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('gatewayName')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
