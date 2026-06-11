import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { AppRunnerConfig } from './types';
import { appRunnerConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function AppRunnerInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<AppRunnerConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<AppRunnerConfig>({
    resolver: zodResolver(appRunnerConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeServiceName = config.serviceName;
  React.useEffect(() => {
    reset(config);
  }, [activeServiceName, reset]);

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
      <InspectorSection title="App Runner Configuration">
        <InspectorField
          label="Service Name"
          error={errors.serviceName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('serviceName')}
          />
        </InspectorField>

        <InspectorField label="CPU" error={errors.cpu?.message}>
          <Select {...register('cpu')}>
            <option value="0.25 vCPU">0.25 vCPU</option>
            <option value="0.5 vCPU">0.5 vCPU</option>
            <option value="1 vCPU">1 vCPU</option>
            <option value="2 vCPU">2 vCPU</option>
          </Select>
        </InspectorField>

        <InspectorField label="Memory" error={errors.memory?.message}>
          <Select {...register('memory')}>
            <option value="0.5 GB">0.5 GB</option>
            <option value="1 GB">1 GB</option>
            <option value="2 GB">2 GB</option>
            <option value="3 GB">3 GB</option>
            <option value="4 GB">4 GB</option>
          </Select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
