import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react';
import type { ServiceInspectorProps } from '../types';
import type { StepFunctionConfig } from './types';
import { stepFunctionConfigSchema } from '@/schemas/resources.schema';
import {
  Input,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui';
import {
  InspectorSection,
  InspectorField,
  CodeEditorField,
} from '@/components';

export function StepFunctionInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<StepFunctionConfig>) {
  const {
    register,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<StepFunctionConfig>({
    resolver: zodResolver(stepFunctionConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeStateMachineName = config.stateMachineName;
  React.useEffect(() => {
    reset(config);
  }, [activeStateMachineName, reset]);

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
      <InspectorSection title="State Machine Configuration">
        <InspectorField
          label="State Machine Name"
          error={errors.stateMachineName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('stateMachineName')}
          />
        </InspectorField>

        <InspectorField label="Type" error={errors.type?.message}>
          <input type="hidden" {...register('type')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span>{watchedValues.type}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={watchedValues.type}
                onValueChange={(val) =>
                  setValue('type', val as 'STANDARD' | 'EXPRESS', {
                    shouldValidate: true,
                  })
                }
              >
                <DropdownMenuRadioItem
                  value="STANDARD"
                  className="cursor-pointer text-xs"
                >
                  STANDARD
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="EXPRESS"
                  className="cursor-pointer text-xs"
                >
                  EXPRESS
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InspectorField>
      </InspectorSection>

      <CodeEditorField
        label="Amazon States Language (ASL) Definition"
        error={errors.definition?.message}
        value={watchedValues.definition}
        registerProps={register('definition')}
      />
    </div>
  );
}
