import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { VPCConfig } from './types';
import { vpcConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function VPCInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<VPCConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<VPCConfig>({
    resolver: zodResolver(vpcConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeVpcName = config.vpcName;
  React.useEffect(() => {
    reset(config);
  }, [activeVpcName, reset]);

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
      <InspectorSection title="VPC Configuration">
        <InspectorField label="VPC Name" error={errors.vpcName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('vpcName')}
          />
        </InspectorField>

        <InspectorField label="CIDR Block" error={errors.cidrBlock?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="10.0.0.0/16"
            {...register('cidrBlock')}
          />
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('enableDnsHostnames')}
            />
            <span>Enable DNS Hostnames</span>
          </label>

          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('enableDnsSupport')}
            />
            <span>Enable DNS Support</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
