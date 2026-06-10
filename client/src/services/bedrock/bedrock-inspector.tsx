import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ServiceInspectorProps } from '../types';
import type { BedrockConfig, BedrockGuardrailMode } from './types';
import { bedrockConfigSchema } from '@/schemas/resources.schema';
import { Input, Select } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

const GUARDRAIL_MODE_OPTIONS: Array<{
  value: BedrockGuardrailMode;
  label: string;
}> = [
  { value: 'NONE', label: 'No guardrail' },
  { value: 'ATTACHED', label: 'Guardrail attached' },
];

export function BedrockInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<BedrockConfig>) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<BedrockConfig>({
    resolver: zodResolver(bedrockConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeAgentName = config.agentName;
  React.useEffect(() => {
    reset(config);
  }, [activeAgentName, reset]);

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
      <InspectorSection title="Bedrock Configuration">
        <InspectorField label="Agent Name" error={errors.agentName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('agentName')}
          />
        </InspectorField>

        <InspectorField
          label="Foundation Model"
          error={errors.foundationModel?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('foundationModel')}
          />
        </InspectorField>

        <InspectorField
          label="Guardrail Mode"
          error={errors.guardrailMode?.message}
        >
          <Select
            {...register('guardrailMode')}
          >
            {GUARDRAIL_MODE_OPTIONS.map((option) => (
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
