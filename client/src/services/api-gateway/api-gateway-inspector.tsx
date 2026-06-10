import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { ServiceInspectorProps } from '../types';
import type { APIGatewayConfig } from './types';
import { apiGatewayConfigSchema } from '@/schemas/resources.schema';
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

export function APIGatewayInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<APIGatewayConfig>) {
  const {
    register,
    watch,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<APIGatewayConfig>({
    resolver: zodResolver(apiGatewayConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const {
    fields: routeFields,
    append: appendRoute,
    remove: removeRoute,
  } = useFieldArray({
    control,
    name: 'routes',
  });

  const activeApiName = config.apiName;
  React.useEffect(() => {
    reset(config);
  }, [activeApiName, reset]);

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
      <InspectorSection title="API Gateway Configuration">
        <InspectorField label="API Name" error={errors.apiName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('apiName')}
          />
        </InspectorField>

        <InspectorField label="API Type" error={errors.apiType?.message}>
          <input type="hidden" {...register('apiType')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span>{watchedValues.apiType}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={watchedValues.apiType}
                onValueChange={(val) =>
                  setValue('apiType', val as 'REST' | 'HTTP' | 'WEBSOCKET', {
                    shouldValidate: true,
                  })
                }
              >
                <DropdownMenuRadioItem
                  value="HTTP"
                  className="cursor-pointer text-xs"
                >
                  HTTP API (Recommended)
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="REST"
                  className="cursor-pointer text-xs"
                >
                  REST API
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="WEBSOCKET"
                  className="cursor-pointer text-xs"
                >
                  WebSocket API
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InspectorField>

        <InspectorField label="Stage Name" error={errors.stageName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('stageName')}
          />
        </InspectorField>
      </InspectorSection>

      {/* Routes Section */}
      <InspectorSection title="API Routes">
        <div className="space-y-3">
          {routeFields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  Route #{index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRoute(index)}
                  className="h-6 px-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <InspectorField label="Path">
                    <Input
                      type="text"
                      className="h-7 text-[10px]"
                      placeholder="/hello"
                      {...register(`routes.${index}.path`)}
                    />
                  </InspectorField>
                </div>
                <div>
                  <InspectorField label="Method">
                    <input
                      type="hidden"
                      {...register(`routes.${index}.method`)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex h-7 w-full justify-between rounded-md border border-border bg-background/50 px-2 py-1 text-[10px] font-normal text-foreground transition-colors hover:bg-accent/50"
                        >
                          <span>
                            {watchedValues.routes?.[index]?.method || 'GET'}
                          </span>
                          <ChevronDown className="size-3 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="border-border bg-card">
                        <DropdownMenuRadioGroup
                          value={watchedValues.routes?.[index]?.method || 'GET'}
                          onValueChange={(val) =>
                            setValue(`routes.${index}.method`, val as any, {
                              shouldValidate: true,
                            })
                          }
                        >
                          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY'].map(
                            (method) => (
                              <DropdownMenuRadioItem
                                key={method}
                                value={method}
                                className="cursor-pointer text-xs"
                              >
                                {method}
                              </DropdownMenuRadioItem>
                            ),
                          )}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </InspectorField>
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendRoute({
                id: Math.random().toString(),
                path: '/route',
                method: 'GET',
              })
            }
            className="flex h-7 w-full items-center justify-center gap-1 text-[10px]"
          >
            <Plus className="size-3" /> Add Route
          </Button>
        </div>
      </InspectorSection>
    </div>
  );
}
