import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { ServiceInspectorProps } from '../types';
import type { RouteTableConfig } from './types';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const routeTableConfigSchema = z.object({
  routeTableName: z.string().min(1, 'Route Table Name is required.'),
});

export function RouteTableInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<RouteTableConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<RouteTableConfig>({
    resolver: zodResolver(routeTableConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeRouteTableName = config.routeTableName;
  React.useEffect(() => {
    reset(config);
  }, [activeRouteTableName, reset]);

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
      <InspectorSection title="Route Table Configuration">
        <InspectorField
          label="Route Table Name"
          error={errors.routeTableName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('routeTableName')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
