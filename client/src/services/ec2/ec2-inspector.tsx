import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { ServiceInspectorProps } from '../types';
import type { EC2Config } from './types';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const ec2ConfigSchema = z.object({
  instanceName: z.string().min(1, 'Instance Name is required.'),
  instanceType: z.string().min(1, 'Instance Type is required.'),
  ami: z.string(),
  keyPairName: z.string(),
  publicIpEnabled: z.boolean(),
});

export function EC2Inspector({
  config,
  onUpdate,
}: ServiceInspectorProps<EC2Config>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<EC2Config>({
    resolver: zodResolver(ec2ConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeInstanceName = config.instanceName;
  React.useEffect(() => {
    reset(config);
  }, [activeInstanceName, reset]);

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
      <InspectorSection title="EC2 Configuration">
        <InspectorField
          label="Instance Name"
          error={errors.instanceName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('instanceName')}
          />
        </InspectorField>

        <InspectorField
          label="Instance Type"
          error={errors.instanceType?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="t3.micro"
            {...register('instanceType')}
          />
        </InspectorField>

        <InspectorField label="AMI" error={errors.ami?.message} optional>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="ami-0c55b159cbfafe1f0"
            {...register('ami')}
          />
        </InspectorField>

        <InspectorField
          label="Key Pair Name"
          error={errors.keyPairName?.message}
          optional
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('keyPairName')}
          />
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('publicIpEnabled')}
            />
            <span>Enable Public IP</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
