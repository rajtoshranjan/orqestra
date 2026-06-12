import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';
import { eksClusterConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { EksClusterConfig } from './types';

export function EksClusterInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<EksClusterConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<EksClusterConfig>({
    resolver: zodResolver(eksClusterConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeClusterName = config.clusterName;
  React.useEffect(() => {
    reset(config);
  }, [activeClusterName, reset]);

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
      <InspectorSection title="EKS Cluster Configuration">
        <InspectorField
          label="Cluster Name"
          error={errors.clusterName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('clusterName')}
          />
        </InspectorField>

        <InspectorField
          label="Kubernetes Version"
          error={errors.kubernetesVersion?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('kubernetesVersion')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
