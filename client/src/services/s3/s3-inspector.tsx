import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import { Input } from '@/components/ui';
import { s3ConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { S3Config } from './types';

export function S3Inspector({
  config,
  onUpdate,
}: ServiceInspectorProps<S3Config>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<S3Config>({
    resolver: zodResolver(s3ConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeBucketName = config.bucketName;
  React.useEffect(() => {
    reset(config);
  }, [activeBucketName, reset]);

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
      <InspectorSection title="S3 Configuration">
        <InspectorField label="Bucket Name" error={errors.bucketName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('bucketName')}
          />
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('versioning')}
            />
            <span>Enable Bucket Versioning</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
