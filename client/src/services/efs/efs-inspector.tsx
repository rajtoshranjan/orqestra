import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { ServiceInspectorProps } from '../types';
import type { EFSConfig } from './types';
import { efsConfigSchema } from '@/schemas/resources.schema';
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

export function EFSInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<EFSConfig>) {
  const {
    register,
    watch,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EFSConfig>({
    resolver: zodResolver(efsConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const {
    fields: apFields,
    append: appendAp,
    remove: removeAp,
  } = useFieldArray({
    control,
    name: 'accessPoints',
  });

  const activeToken = config.creationToken;
  React.useEffect(() => {
    reset(config);
  }, [activeToken, reset]);

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
      <InspectorSection title="EFS Configuration">
        <InspectorField
          label="Creation Token"
          error={errors.creationToken?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('creationToken')}
          />
        </InspectorField>

        <InspectorField
          label="Performance Mode"
          error={errors.performanceMode?.message}
        >
          <input type="hidden" {...register('performanceMode')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span>{watchedValues.performanceMode}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={watchedValues.performanceMode}
                onValueChange={(val) =>
                  setValue(
                    'performanceMode',
                    val as 'generalPurpose' | 'maxIO',
                    { shouldValidate: true },
                  )
                }
              >
                <DropdownMenuRadioItem
                  value="generalPurpose"
                  className="cursor-pointer text-xs"
                >
                  generalPurpose
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="maxIO"
                  className="cursor-pointer text-xs"
                >
                  maxIO
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InspectorField>

        <InspectorField
          label="Throughput Mode"
          error={errors.throughputMode?.message}
        >
          <input type="hidden" {...register('throughputMode')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span>{watchedValues.throughputMode}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={watchedValues.throughputMode}
                onValueChange={(val) =>
                  setValue(
                    'throughputMode',
                    val as 'bursting' | 'provisioned' | 'elastic',
                    { shouldValidate: true },
                  )
                }
              >
                <DropdownMenuRadioItem
                  value="bursting"
                  className="cursor-pointer text-xs"
                >
                  bursting
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="provisioned"
                  className="cursor-pointer text-xs"
                >
                  provisioned
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="elastic"
                  className="cursor-pointer text-xs"
                >
                  elastic
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InspectorField>

        {watchedValues.throughputMode === 'provisioned' && (
          <InspectorField
            label="Provisioned Throughput (MiB/s)"
            error={errors.provisionedThroughputInMibps?.message}
          >
            <Input
              type="number"
              className="border-border/80 bg-background/50 text-foreground"
              {...register('provisionedThroughputInMibps', {
                valueAsNumber: true,
              })}
            />
          </InspectorField>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('encrypted')}
            />
            <span>Enable Encryption (KMS AES-256)</span>
          </label>
        </div>
      </InspectorSection>

      {/* Access Points */}
      <InspectorSection title="EFS Access Points">
        <div className="space-y-3">
          {apFields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  Access Point #{index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAp(index)}
                  className="h-6 px-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <InspectorField label="AP Name">
                <Input
                  type="text"
                  className="h-7 text-[10px]"
                  placeholder="my-ap"
                  {...register(`accessPoints.${index}.name`)}
                />
              </InspectorField>

              <InspectorField label="Path (must start with /)">
                <Input
                  type="text"
                  className="h-7 text-[10px]"
                  placeholder="/lambda"
                  {...register(`accessPoints.${index}.path`)}
                />
              </InspectorField>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendAp({
                id: Math.random().toString(),
                name: 'lambda-ap',
                path: '/lambda',
              })
            }
            className="flex h-7 w-full items-center justify-center gap-1 text-[10px]"
          >
            <Plus className="size-3" /> Add Access Point
          </Button>
        </div>
      </InspectorSection>
    </div>
  );
}
