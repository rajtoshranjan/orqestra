import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type {
  GuardDutyConfig,
  GuardDutyFindingPublishingFrequency,
} from './types';
import { guarddutyConfigSchema } from '@/schemas/resources.schema';
import { Input } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const FINDING_PUBLISHING_FREQUENCY_OPTIONS: Array<{
  value: GuardDutyFindingPublishingFrequency;
  label: string;
}> = [
  { value: 'FIFTEEN_MINUTES', label: '15 minutes' },
  { value: 'ONE_HOUR', label: '1 hour' },
  { value: 'SIX_HOURS', label: '6 hours' },
];

export function GuardDutyInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<GuardDutyConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<GuardDutyConfig>({
    resolver: zodResolver(guarddutyConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeDetectorName = config.detectorName;
  React.useEffect(() => {
    reset(config);
  }, [activeDetectorName, reset]);

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
      <InspectorSection title="GuardDuty Configuration">
        <InspectorField
          label="Detector Name"
          error={errors.detectorName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('detectorName')}
          />
        </InspectorField>

        <InspectorField
          label="Finding Publishing Frequency"
          error={errors.findingPublishingFrequency?.message}
        >
          <select
            className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            {...register('findingPublishingFrequency')}
          >
            {FINDING_PUBLISHING_FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </InspectorField>
      </InspectorSection>
    </div>
  );
}
