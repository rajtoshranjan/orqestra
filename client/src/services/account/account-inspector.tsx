import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { AccountConfig } from './types';
import { accountConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function AccountInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<AccountConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<AccountConfig>({
    resolver: zodResolver(accountConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeAccountId = config.accountId;
  React.useEffect(() => {
    reset(config);
  }, [activeAccountId, reset]);

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
      <InspectorSection title="Account Configuration">
        <InspectorField
          label="12-digit Account ID"
          error={errors.accountId?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 font-mono text-foreground"
            placeholder="123456789012"
            maxLength={12}
            {...register('accountId')}
          />
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
