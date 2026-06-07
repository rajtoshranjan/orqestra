import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react';
import type { ServiceInspectorProps } from '../types';
import type { ECRConfig } from './types';
import { ecrConfigSchema } from '@/schemas/resources.schema';
import {
  Input,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function ECRInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<ECRConfig>) {
  const {
    register,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ECRConfig>({
    resolver: zodResolver(ecrConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeRepositoryName = config.repositoryName;
  React.useEffect(() => {
    reset(config);
  }, [activeRepositoryName, reset]);

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
      <InspectorSection title="ECR Configuration">
        <InspectorField
          label="Repository Name"
          error={errors.repositoryName?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('repositoryName')}
          />
        </InspectorField>

        <InspectorField
          label="Tag Mutability"
          error={errors.imageTagMutability?.message}
        >
          <input type="hidden" {...register('imageTagMutability')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span>{watchedValues.imageTagMutability}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={watchedValues.imageTagMutability}
                onValueChange={(val) =>
                  setValue(
                    'imageTagMutability',
                    val as 'MUTABLE' | 'IMMUTABLE',
                    { shouldValidate: true },
                  )
                }
              >
                <DropdownMenuRadioItem
                  value="MUTABLE"
                  className="cursor-pointer text-xs"
                >
                  MUTABLE
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="IMMUTABLE"
                  className="cursor-pointer text-xs"
                >
                  IMMUTABLE
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InspectorField>

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('scanOnPush')}
            />
            <span>Scan on Push</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
