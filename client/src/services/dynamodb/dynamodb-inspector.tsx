import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react';
import type { ServiceInspectorProps } from '../types';
import type { DynamoDBConfig } from './types';
import { dynamodbConfigSchema } from '@/schemas/resources.schema';
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

export function DynamoDBInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<DynamoDBConfig>) {
  const {
    register,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DynamoDBConfig>({
    resolver: zodResolver(dynamodbConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeTableName = config.tableName;
  React.useEffect(() => {
    reset(config);
  }, [activeTableName, reset]);

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
      <InspectorSection title="Table Configuration">
        <InspectorField label="Table Name" error={errors.tableName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('tableName')}
          />
        </InspectorField>

        <InspectorField
          label="Billing Mode"
          error={errors.billingMode?.message}
        >
          <input type="hidden" {...register('billingMode')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span>
                  {watchedValues.billingMode === 'PAY_PER_REQUEST'
                    ? 'On-Demand (Pay-per-Request)'
                    : 'Provisioned'}
                </span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={watchedValues.billingMode}
                onValueChange={(val) =>
                  setValue(
                    'billingMode',
                    val as 'PAY_PER_REQUEST' | 'PROVISIONED',
                    { shouldValidate: true },
                  )
                }
              >
                <DropdownMenuRadioItem
                  value="PAY_PER_REQUEST"
                  className="cursor-pointer text-xs"
                >
                  On-Demand
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="PROVISIONED"
                  className="cursor-pointer text-xs"
                >
                  Provisioned
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InspectorField>
      </InspectorSection>

      <InspectorSection title="Primary Key Attributes">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <InspectorField
              label="Partition Key (Hash Key)"
              error={errors.hashKey?.message}
            >
              <Input
                type="text"
                className="h-8 border-border/80 bg-background/50 text-xs text-foreground"
                {...register('hashKey')}
              />
            </InspectorField>
          </div>
          <div>
            <InspectorField label="Type" error={errors.hashKeyType?.message}>
              <input type="hidden" {...register('hashKeyType')} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex h-8 w-full justify-between rounded-md border border-border bg-background/50 px-2 py-1 text-xs font-normal text-foreground transition-colors hover:bg-accent/50"
                  >
                    <span>{watchedValues.hashKeyType}</span>
                    <ChevronDown className="size-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-border bg-card">
                  <DropdownMenuRadioGroup
                    value={watchedValues.hashKeyType}
                    onValueChange={(val) =>
                      setValue('hashKeyType', val as 'S' | 'N' | 'B', {
                        shouldValidate: true,
                      })
                    }
                  >
                    <DropdownMenuRadioItem
                      value="S"
                      className="cursor-pointer text-xs"
                    >
                      String (S)
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="N"
                      className="cursor-pointer text-xs"
                    >
                      Number (N)
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="B"
                      className="cursor-pointer text-xs"
                    >
                      Binary (B)
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </InspectorField>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <InspectorField
              label="Sort Key (Range Key) - Optional"
              error={errors.rangeKey?.message}
              optional
            >
              <Input
                type="text"
                className="h-8 border-border/80 bg-background/50 text-xs text-foreground"
                {...register('rangeKey')}
              />
            </InspectorField>
          </div>
          <div>
            <InspectorField
              label="Type"
              error={errors.rangeKeyType?.message}
              optional
            >
              <input type="hidden" {...register('rangeKeyType')} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex h-8 w-full justify-between rounded-md border border-border bg-background/50 px-2 py-1 text-xs font-normal text-foreground transition-colors hover:bg-accent/50"
                    disabled={!watchedValues.rangeKey}
                  >
                    <span>{watchedValues.rangeKeyType || 'S'}</span>
                    <ChevronDown className="size-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-border bg-card">
                  <DropdownMenuRadioGroup
                    value={watchedValues.rangeKeyType || 'S'}
                    onValueChange={(val) =>
                      setValue('rangeKeyType', val as 'S' | 'N' | 'B', {
                        shouldValidate: true,
                      })
                    }
                  >
                    <DropdownMenuRadioItem
                      value="S"
                      className="cursor-pointer text-xs"
                    >
                      String (S)
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="N"
                      className="cursor-pointer text-xs"
                    >
                      Number (N)
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="B"
                      className="cursor-pointer text-xs"
                    >
                      Binary (B)
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </InspectorField>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="DynamoDB Streams">
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-background/50 text-primary focus:ring-accent"
              {...register('streamEnabled')}
            />
            <span>Enable DynamoDB Stream</span>
          </label>
        </div>

        {watchedValues.streamEnabled && (
          <InspectorField
            label="Stream View Type"
            error={errors.streamViewType?.message}
            className="mt-3"
          >
            <input type="hidden" {...register('streamViewType')} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex h-8 w-full justify-between rounded-md border border-border bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
                >
                  <span>
                    {watchedValues.streamViewType || 'NEW_AND_OLD_IMAGES'}
                  </span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px] border-border bg-card">
                <DropdownMenuRadioGroup
                  value={watchedValues.streamViewType || 'NEW_AND_OLD_IMAGES'}
                  onValueChange={(val) =>
                    setValue('streamViewType', val as any, {
                      shouldValidate: true,
                    })
                  }
                >
                  {[
                    'NEW_IMAGE',
                    'OLD_IMAGE',
                    'NEW_AND_OLD_IMAGES',
                    'KEYS_ONLY',
                  ].map((type) => (
                    <DropdownMenuRadioItem
                      key={type}
                      value={type}
                      className="cursor-pointer text-xs"
                    >
                      {type}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </InspectorField>
        )}
      </InspectorSection>
    </div>
  );
}
