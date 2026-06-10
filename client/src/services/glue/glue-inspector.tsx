import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { GlueConfig, GlueDataSourceType } from './types';
import { glueConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const DATA_SOURCE_TYPE_OPTIONS: Array<{
  value: GlueDataSourceType;
  label: string;
}> = [
  { value: 'S3', label: 'Amazon S3' },
  { value: 'JDBC', label: 'JDBC' },
  { value: 'DynamoDB', label: 'DynamoDB' },
  { value: 'Kafka', label: 'Kafka' },
];

export function GlueInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<GlueConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<GlueConfig>({
    resolver: zodResolver(glueConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeDatabaseName = config.databaseName;
  React.useEffect(() => {
    reset(config);
  }, [activeDatabaseName, reset]);

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
      <InspectorSection title="Glue Configuration">
        <InspectorField
          label="Database Name"
          error={errors.databaseName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('databaseName')}
          />
        </InspectorField>

        <InspectorField
          label="Crawler Name"
          error={errors.crawlerName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('crawlerName')}
          />
        </InspectorField>

        <InspectorField
          label="Data Source Type"
          error={errors.dataSourceType?.message}
        >
          <Select
            {...register('dataSourceType')}
          >
            {DATA_SOURCE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
