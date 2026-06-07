import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { TrustBoundaryConfig } from './types';
import { trustBoundaryConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function TrustBoundaryInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<TrustBoundaryConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<TrustBoundaryConfig>({
    resolver: zodResolver(trustBoundaryConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeBoundaryName = config.boundaryName;
  React.useEffect(() => {
    reset(config);
  }, [activeBoundaryName, reset]);

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
      <InspectorSection title="Trust Boundary Configuration">
        <InspectorField
          label="Boundary Name"
          error={errors.boundaryName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="trust-boundary-1"
            {...register('boundaryName')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
