import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import type { ServiceInspectorProps } from '../types';
import type { IAMRoleConfig } from './types';
import { iamRoleConfigSchema } from '@/schemas/resources.schema';
import { Input, Button, Textarea } from '@/components/ui';
import {
  InspectorSection,
  InspectorField,
  CodeEditorField,
} from '@/components';

export function IAMRoleInspector({
  config,
  onUpdate,
}: ServiceInspectorProps<IAMRoleConfig>) {
  const {
    register,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<IAMRoleConfig>({
    resolver: zodResolver(iamRoleConfigSchema),
    defaultValues: config,
    mode: 'all',
  });

  const {
    fields: inlineFields,
    append: appendInline,
    remove: removeInline,
  } = useFieldArray({
    control,
    name: 'inlinePolicies',
  });

  const activeRoleName = config.roleName;
  React.useEffect(() => {
    reset(config);
  }, [activeRoleName, reset]);

  const watchedValues = watch();
  const lastUpdatedRef = React.useRef<string>('');

  React.useEffect(() => {
    const serialized = JSON.stringify(watchedValues);
    if (serialized !== lastUpdatedRef.current) {
      lastUpdatedRef.current = serialized;
      onUpdate(() => watchedValues);
    }
  }, [watchedValues, onUpdate]);

  // Simple string representation for managed policy lists
  const [managedPolicyInput, setManagedPolicyInput] = React.useState(
    config.managedPolicyArns?.join('\n') || '',
  );

  React.useEffect(() => {
    setManagedPolicyInput(watchedValues.managedPolicyArns?.join('\n') || '');
  }, [watchedValues.managedPolicyArns]);

  return (
    <div className="animate-fade-in space-y-6">
      <InspectorSection title="IAM Role Configuration">
        <InspectorField label="Role Name" error={errors.roleName?.message}>
          <Input
            type="text"
            className="border-border/80 bg-background/50 text-foreground"
            {...register('roleName')}
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

      <CodeEditorField
        label="Trust Relationship (Assume Role Policy)"
        error={errors.assumeRolePolicyDocument?.message}
        value={watchedValues.assumeRolePolicyDocument}
        registerProps={register('assumeRolePolicyDocument')}
      />

      <InspectorSection title="Managed Policies (one ARN per line)">
        <Textarea
          className="font-mono text-xs"
          value={managedPolicyInput}
          onChange={(event) => {
            const value = event.target.value;
            setManagedPolicyInput(value);
            const arns = value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean);
            onUpdate((prev) => ({ ...prev, managedPolicyArns: arns }));
          }}
          placeholder="arn:aws:iam::aws:policy/..."
        />
      </InspectorSection>

      <InspectorSection title="Inline Policies">
        <div className="space-y-3">
          {inlineFields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  Inline Policy #{index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeInline(index)}
                  className="h-6 px-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <InspectorField label="Policy Name">
                <Input
                  type="text"
                  className="h-7 text-[10px]"
                  placeholder="lambda-s3-inline"
                  {...register(`inlinePolicies.${index}.name`)}
                />
              </InspectorField>

              <CodeEditorField
                label="Policy Document"
                value={watchedValues.inlinePolicies?.[index]?.document || ''}
                registerProps={register(`inlinePolicies.${index}.document`)}
              />
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendInline({
                id: Math.random().toString(),
                name: 'custom-policy',
                document: '{\n  "Version": "2012-10-17",\n  "Statement": []\n}',
              })
            }
            className="flex h-7 w-full items-center justify-center gap-1 text-[10px]"
          >
            <Plus className="size-3" /> Add Inline Policy
          </Button>
        </div>
      </InspectorSection>
    </div>
  );
}
