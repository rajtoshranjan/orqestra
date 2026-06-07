import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { OpenSearchConfig } from './types';
import { opensearchConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function OpenSearchInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<OpenSearchConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<OpenSearchConfig>({
    resolver: zodResolver(opensearchConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeDomainName = config.domainName;
  React.useEffect(() => {
    reset(config);
  }, [activeDomainName, reset]);

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
      <InspectorSection title="OpenSearch Configuration">
        <InspectorField label="Domain Name" error={errors.domainName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('domainName')}
          />
        </InspectorField>

        <InspectorField
          label="Engine Version"
          error={errors.engineVersion?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('engineVersion')}
          />
        </InspectorField>

        <InspectorField
          label="Instance Type"
          error={errors.instanceType?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('instanceType')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
