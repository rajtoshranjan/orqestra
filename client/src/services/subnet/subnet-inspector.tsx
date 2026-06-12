import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { InspectorSection, InspectorField } from '@/components';
import {
  Input,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui';
import { subnetConfigSchema } from '@/schemas/resources.schema';

import type { ServiceInspectorProps } from '../types';
import type { SubnetConfig } from './types';

export function SubnetInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<SubnetConfig>) {
  const {
    register,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SubnetConfig>({
    resolver: zodResolver(subnetConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const activeSubnetName = config.subnetName;
  React.useEffect(() => {
    reset(config);
  }, [activeSubnetName, reset]);

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
      <InspectorSection title="Subnet Configuration">
        <InspectorField label="Subnet Name" error={errors.subnetName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('subnetName')}
          />
        </InspectorField>

        <InspectorField label="CIDR Block" error={errors.cidrBlock?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="10.0.1.0/24"
            {...register('cidrBlock')}
          />
        </InspectorField>

        <InspectorField
          label="Availability Zone"
          error={errors.availabilityZone?.message}
        >
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            placeholder="us-east-1a"
            {...register('availabilityZone')}
          />
        </InspectorField>

        <InspectorField label="Subnet Type" error={errors.subnetType?.message}>
          <input type="hidden" {...register('subnetType')} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex h-8 w-full justify-between rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-xs font-normal text-foreground shadow-sm transition-colors hover:bg-accent/50"
              >
                <span>
                  {watchedValues.subnetType === 'public'
                    ? 'Public (Internet Gateway Router)'
                    : 'Private (NAT Gateway Router)'}
                </span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] border-border bg-card">
              <DropdownMenuRadioGroup
                value={watchedValues.subnetType}
                onValueChange={(val) =>
                  setValue('subnetType', val as 'public' | 'private', {
                    shouldValidate: true,
                  })
                }
              >
                <DropdownMenuRadioItem
                  value="private"
                  className="cursor-pointer text-xs"
                >
                  Private
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="public"
                  className="cursor-pointer text-xs"
                >
                  Public
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
              {...register('mapPublicIpOnLaunch')}
            />
            <span>Map Public IP on Launch</span>
          </label>
        </div>
      </InspectorSection>
    </div>
  );
}
