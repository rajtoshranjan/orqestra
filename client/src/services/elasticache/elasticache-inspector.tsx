import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { ElastiCacheConfig } from './types';
import { elasticacheConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const ENGINE_OPTIONS: Array<{ value: ElastiCacheConfig['engine']; label: string }> = [
  { value: 'redis', label: 'Redis' },
  { value: 'memcached', label: 'Memcached' },
];

export function ElastiCacheInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<ElastiCacheConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<ElastiCacheConfig>({
    resolver: zodResolver(elasticacheConfigSchema),
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
      <InspectorSection title="ElastiCache Configuration">
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

        <InspectorField label="Engine" error={errors.engine?.message}>
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('engine')}
          >
            {ENGINE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </InspectorField>

        <InspectorField
          label="Cache Node Type"
          error={errors.cacheNodeType?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="cache.t3.micro"
            {...register('cacheNodeType')}
          />
        </InspectorField>

        <InspectorField
          label="Number of Cache Nodes"
          error={errors.numCacheNodes?.message}
        >
          <Input
            type="number"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('numCacheNodes', { valueAsNumber: true })}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
