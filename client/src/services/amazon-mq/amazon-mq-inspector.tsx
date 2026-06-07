import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { AmazonMqConfig } from './types';
import { amazonMqConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function AmazonMqInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<AmazonMqConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<AmazonMqConfig>({
    resolver: zodResolver(amazonMqConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeBrokerName = config.brokerName;
  React.useEffect(() => {
    reset(config);
  }, [activeBrokerName, reset]);

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
      <InspectorSection title="Amazon MQ Configuration">
        <InspectorField
          label="Broker Name"
          error={errors.brokerName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('brokerName')}
          />
        </InspectorField>

        <InspectorField
          label="Engine Type"
          error={errors.engineType?.message}
        >
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('engineType')}
          >
            <option value="RABBITMQ">RabbitMQ</option>
            <option value="ACTIVEMQ">ActiveMQ</option>
          </select>
        </InspectorField>

        <InspectorField
          label="Host Instance Type"
          error={errors.hostInstanceType?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('hostInstanceType')}
          />
        </InspectorField>

        <InspectorField
          label="Deployment Mode"
          error={errors.deploymentMode?.message}
        >
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('deploymentMode')}
          >
            <option value="SINGLE_INSTANCE">Single Instance</option>
            <option value="ACTIVE_STANDBY_MULTI_AZ">
              Active/Standby Multi-AZ
            </option>
            <option value="CLUSTER_MULTI_AZ">Cluster Multi-AZ</option>
          </select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
