import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import type { ServiceInspectorProps } from '../types';
import type { SecurityGroupConfig } from './types';
import { makeEmptyRule } from './defaults';
import { securityGroupConfigSchema } from '@/schemas/resources.schema';
import { Input, Button } from '@/components/ui';
import { InspectorSection, InspectorField } from '@/components';

export function SecurityGroupInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<SecurityGroupConfig>) {
  const {
    register,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<SecurityGroupConfig>({
    resolver: zodResolver(securityGroupConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const {
    fields: ingressFields,
    append: appendIngress,
    remove: removeIngress,
  } = useFieldArray({
    control,
    name: 'ingressRules',
  });

  const {
    fields: egressFields,
    append: appendEgress,
    remove: removeEgress,
  } = useFieldArray({
    control,
    name: 'egressRules',
  });

  const activeGroupName = config.groupName;
  React.useEffect(() => {
    reset(config);
  }, [activeGroupName, reset]);

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
      <InspectorSection title="Security Group Configuration">
        <InspectorField label="Group Name" error={errors.groupName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('groupName')}
          />
        </InspectorField>

        <InspectorField label="Description" error={errors.description?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('description')}
          />
        </InspectorField>
      </InspectorSection>

      {/* Inbound Rules */}
      <InspectorSection title="Inbound Rules (Ingress)">
        <div className="space-y-3">
          {ingressFields.map((field, index) => (
            <div
              key={field.id}
              className="relative flex flex-col gap-2 rounded-md border border-border bg-background/30 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  Rule #{index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeIngress(index)}
                  className="h-6 px-1.5 text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <InspectorField label="Protocol">
                  <Input
                    type="text"
                    className="h-7 text-[10px]"
                    placeholder="tcp"
                    {...register(`ingressRules.${index}.protocol`)}
                  />
                </InspectorField>
                <InspectorField label="From Port">
                  <Input
                    type="number"
                    className="h-7 text-[10px]"
                    {...register(`ingressRules.${index}.fromPort`, {
                      valueAsNumber: true,
                    })}
                  />
                </InspectorField>
                <InspectorField label="To Port">
                  <Input
                    type="number"
                    className="h-7 text-[10px]"
                    {...register(`ingressRules.${index}.toPort`, {
                      valueAsNumber: true,
                    })}
                  />
                </InspectorField>
              </div>
              <InspectorField label="Source CIDR">
                <Input
                  type="text"
                  className="h-7 text-[10px]"
                  placeholder="0.0.0.0/0"
                  {...register(`ingressRules.${index}.cidrBlock`)}
                />
              </InspectorField>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendIngress(makeEmptyRule())}
            className="flex h-7 w-full items-center justify-center gap-1 text-[10px]"
          >
            <Plus className="size-3" /> Add Inbound Rule
          </Button>
        </div>
      </InspectorSection>

      {/* Outbound Rules */}
      <InspectorSection title="Outbound Rules (Egress)">
        <div className="space-y-3">
          {egressFields.map((field, index) => (
            <div
              key={field.id}
              className="relative flex flex-col gap-2 rounded-md border border-border bg-background/30 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  Rule #{index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEgress(index)}
                  className="h-6 px-1.5 text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <InspectorField label="Protocol">
                  <Input
                    type="text"
                    className="h-7 text-[10px]"
                    placeholder="tcp"
                    {...register(`egressRules.${index}.protocol`)}
                  />
                </InspectorField>
                <InspectorField label="From Port">
                  <Input
                    type="number"
                    className="h-7 text-[10px]"
                    {...register(`egressRules.${index}.fromPort`, {
                      valueAsNumber: true,
                    })}
                  />
                </InspectorField>
                <InspectorField label="To Port">
                  <Input
                    type="number"
                    className="h-7 text-[10px]"
                    {...register(`egressRules.${index}.toPort`, {
                      valueAsNumber: true,
                    })}
                  />
                </InspectorField>
              </div>
              <InspectorField label="Destination CIDR">
                <Input
                  type="text"
                  className="h-7 text-[10px]"
                  placeholder="0.0.0.0/0"
                  {...register(`egressRules.${index}.cidrBlock`)}
                />
              </InspectorField>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendEgress(makeEmptyRule())}
            className="flex h-7 w-full items-center justify-center gap-1 text-[10px]"
          >
            <Plus className="size-3" /> Add Outbound Rule
          </Button>
        </div>
      </InspectorSection>
    </div>
  );
}
