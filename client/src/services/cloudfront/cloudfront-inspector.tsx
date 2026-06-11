import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type {
  CloudFrontConfig,
  CloudFrontPriceClass,
  CloudFrontViewerProtocolPolicy,
} from './types';
import { cloudfrontConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const PRICE_CLASS_OPTIONS: Array<{
  value: CloudFrontPriceClass;
  label: string;
}> = [
  { value: 'PriceClass_100', label: 'North America / Europe' },
  { value: 'PriceClass_200', label: 'Most edge locations' },
  { value: 'PriceClass_All', label: 'All edge locations' },
];

const VIEWER_PROTOCOL_POLICY_OPTIONS: Array<{
  value: CloudFrontViewerProtocolPolicy;
  label: string;
}> = [
  { value: 'redirect-to-https', label: 'Redirect HTTP to HTTPS' },
  { value: 'https-only', label: 'HTTPS only' },
  { value: 'allow-all', label: 'Allow HTTP and HTTPS' },
];

export function CloudFrontInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<CloudFrontConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<CloudFrontConfig>({
    resolver: zodResolver(cloudfrontConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeDistributionName = config.distributionName;
  React.useEffect(() => {
    reset(config);
  }, [activeDistributionName, reset]);

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
      <InspectorSection title="CloudFront Configuration">
        <InspectorField
          label="Distribution Name"
          error={errors.distributionName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('distributionName')}
          />
        </InspectorField>

        <InspectorField label="Price Class" error={errors.priceClass?.message}>
          <Select {...register('priceClass')}>
            {PRICE_CLASS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </InspectorField>

        <InspectorField
          label="Viewer Protocol Policy"
          error={errors.viewerProtocolPolicy?.message}
        >
          <Select {...register('viewerProtocolPolicy')}>
            {VIEWER_PROTOCOL_POLICY_OPTIONS.map((option) => (
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
