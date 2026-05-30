import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { UseFormRegister } from 'react-hook-form';

import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

/* Field Error Component */
export type FieldErrorProps = {
  message?: string;
};

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p className="animate-fade-in mt-1.5 text-[11px] font-medium leading-tight text-destructive">
      {message}
    </p>
  );
}

/* Inspector Section Wrapper */
export type InspectorSectionProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function InspectorSection({
  title,
  children,
  className,
}: InspectorSectionProps) {
  return (
    <section
      className={cn(
        'border-b border-border/40 pb-5 last:border-0 last:pb-0',
        className,
      )}
    >
      <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/* Inspector Field Wrapper */
export type InspectorFieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  optional?: boolean;
};

export function InspectorField({
  label,
  error,
  children,
  className,
  optional,
}: InspectorFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <label className="input-label font-medium text-foreground/80">
          {label}
        </label>
        {optional && (
          <span className="select-none text-[10px] text-muted-foreground">
            Optional
          </span>
        )}
      </div>
      {children}
      <FieldError message={error} />
    </div>
  );
}

/* Code Editor Field Wrapper */
export type CodeEditorFieldProps = {
  label: string;
  error?: string;
  value?: string;
  className?: string;
  registerProps: Record<string, unknown>;
  minHeight?: number;
};

export function CodeEditorField({
  label,
  error,
  value = '',
  className,
  registerProps,
  minHeight = 200,
}: CodeEditorFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="input-label font-medium text-foreground/80">
        {label}
      </label>
      <div className="relative rounded-md border border-border/80 bg-background/50 focus-within:ring-1 focus-within:ring-ring">
        <textarea
          className="w-full resize-y bg-transparent px-3 py-2 font-mono text-[11px] text-foreground focus:outline-none"
          style={{
            minHeight,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}
          {...registerProps}
        />
        <div className="pointer-events-none absolute bottom-2 right-3 select-none rounded bg-background/80 px-1 text-[9px] font-semibold text-muted-foreground">
          {value.length} chars
        </div>
      </div>
      <FieldError message={error} />
    </div>
  );
}

/* Reusable Key-Value Row Definition */
export type KeyValueItem = {
  id: string;
  key: string;
  value: string;
};

export type KeyValueEditorProps<T extends Record<string, any>> = {
  title: string;
  fields: KeyValueItem[];
  register: UseFormRegister<T>;
  remove: (index: number) => void;
  append: (value: any) => void;
  namePrefix: string;
  error?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addButtonText?: string;
  makeEmptyValue?: () => any;
};

export function KeyValueEditor<T extends Record<string, any>>({
  title,
  fields,
  register,
  remove,
  append,
  namePrefix,
  error,
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'Value',
  addButtonText = 'Add variable',
  makeEmptyValue = () => ({ key: '', value: '' }),
}: KeyValueEditorProps<T>) {
  return (
    <section className="border-b border-border/40 pb-5 last:border-0 last:pb-0">
      <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="animate-scale-in flex items-center gap-2"
          >
            <Input
              type="text"
              className="h-8 border-border/80 bg-background/50 font-mono text-[11px] text-foreground"
              placeholder={keyPlaceholder}
              {...register(`${namePrefix}.${index}.key` as any)}
            />
            <Input
              type="text"
              className="h-8 border-border/80 bg-background/50 font-mono text-[11px] text-foreground"
              placeholder={valuePlaceholder}
              {...register(`${namePrefix}.${index}.value` as any)}
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => remove(index)}
              className="size-8 shrink-0 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remove item"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}

        <FieldError message={error} />

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => append(makeEmptyValue())}
          className="mt-1 flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-primary transition-colors hover:bg-accent/40"
        >
          <Plus className="size-3.5" />
          {addButtonText}
        </Button>
      </div>
    </section>
  );
}
