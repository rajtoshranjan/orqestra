import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { ElasticBeanstalkConfig } from './types';
import { elasticBeanstalkConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function ElasticBeanstalkInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<ElasticBeanstalkConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<ElasticBeanstalkConfig>({
    resolver: zodResolver(elasticBeanstalkConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeApplicationName = config.applicationName;
  React.useEffect(() => {
    reset(config);
  }, [activeApplicationName, reset]);

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
      <InspectorSection title="Elastic Beanstalk Configuration">
        <InspectorField
          label="Application Name"
          error={errors.applicationName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('applicationName')}
          />
        </InspectorField>

        <InspectorField label="Platform" error={errors.platform?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('platform')}
          />
        </InspectorField>

        <InspectorField
          label="Environment Tier"
          error={errors.environmentTier?.message}
        >
          <Select
            {...register('environmentTier')}
          >
            <option value="WebServer">WebServer</option>
            <option value="Worker">Worker</option>
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
