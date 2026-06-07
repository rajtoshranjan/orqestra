import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { NetworkAclConfig } from './types';
import { networkAclConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function NetworkAclInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<NetworkAclConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<NetworkAclConfig>({
    resolver: zodResolver(networkAclConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeAclName = config.aclName;
  React.useEffect(() => {
    reset(config);
  }, [activeAclName, reset]);

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
      <InspectorSection title="Network ACL Configuration">
        <InspectorField label="ACL Name" error={errors.aclName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('aclName')}
          />
        </InspectorField>

        <InspectorField
          label="Default Action"
          error={errors.defaultAction?.message}
        >
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('defaultAction')}
          >
            <option value="deny">Deny</option>
            <option value="allow">Allow</option>
          </select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
