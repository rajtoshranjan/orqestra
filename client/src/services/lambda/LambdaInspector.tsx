import { Plus, Trash2 } from 'lucide-react';

import type { ServiceInspectorProps } from '../types';
import type { LambdaConfig, LambdaRuntime } from './types';
import { RUNTIME_OPTIONS } from './types';
import {
  getDefaultHandlerForRuntime,
  getDefaultCodeForRuntime,
  makeEnvironmentVariable,
} from './defaults';
import { Button, Input } from '@/components/ui';

/* ─── Shared sub-components ───────────────────────────────────────────── */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="animate-fade-in mt-1 text-xs text-destructive">{message}</p>
  );
}

/* ─── Lambda Inspector ────────────────────────────────────────────────── */

export function LambdaInspector({
  config,
  validationErrors,
  onUpdate,
}: ServiceInspectorProps<LambdaConfig>) {
  function patch(updates: Partial<LambdaConfig>) {
    onUpdate((prev) => ({ ...prev, ...updates }));
  }

  function handleRuntimeChange(runtime: LambdaRuntime) {
    onUpdate((prev) => ({
      ...prev,
      runtime,
      handler: getDefaultHandlerForRuntime(runtime),
      code: getDefaultCodeForRuntime(runtime),
    }));
  }

  function handleEnvChange(
    id: string,
    field: 'key' | 'value',
    newValue: string,
  ) {
    onUpdate((prev) => ({
      ...prev,
      environmentVariables: prev.environmentVariables.map((entry) =>
        entry.id === id ? { ...entry, [field]: newValue } : entry,
      ),
    }));
  }

  function addEnvVariable() {
    onUpdate((prev) => ({
      ...prev,
      environmentVariables: [
        ...prev.environmentVariables,
        makeEnvironmentVariable(),
      ],
    }));
  }

  function removeEnvVariable(id: string) {
    onUpdate((prev) => ({
      ...prev,
      environmentVariables: prev.environmentVariables.filter(
        (entry) => entry.id !== id,
      ),
    }));
  }

  return (
    <div className="space-y-6">
      {/* ── Configuration Section ─────────────────────────────── */}
      <section>
        <SectionHeader>Configuration</SectionHeader>
        <div className="space-y-4">
          {/* Function Name */}
          <div>
            <label className="input-label">Function Name</label>
            <Input
              type="text"
              className="border-border/80 bg-background/50 text-foreground"
              value={config.functionName}
              onChange={(e) => patch({ functionName: e.target.value })}
            />
            <FieldError message={validationErrors.functionName} />
          </div>

          {/* Runtime */}
          <div>
            <label className="input-label">Runtime</label>
            <select
              className="border-border/80 bg-background/50 flex h-9 w-full rounded-md border px-3 py-1.5 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={config.runtime}
              onChange={(e) =>
                handleRuntimeChange(e.target.value as LambdaRuntime)
              }
            >
              {RUNTIME_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-card text-foreground"
                >
                  {opt.label}
                </option>
              ))}
            </select>
            <FieldError message={validationErrors.runtime} />
          </div>

          {/* Handler */}
          <div>
            <label className="input-label">Handler</label>
            <Input
              type="text"
              className="border-border/80 bg-background/50 text-foreground"
              value={config.handler}
              onChange={(e) => patch({ handler: e.target.value })}
            />
            <FieldError message={validationErrors.handler} />
          </div>

          {/* Memory Size */}
          <div>
            <label className="input-label">Memory (MB)</label>
            <Input
              type="number"
              className="border-border/80 bg-background/50 text-foreground"
              min={128}
              max={10240}
              value={config.memorySize}
              onChange={(e) => patch({ memorySize: Number(e.target.value) })}
            />
            <FieldError message={validationErrors.memorySize} />
          </div>

          {/* Timeout */}
          <div>
            <label className="input-label">Timeout (seconds)</label>
            <Input
              type="number"
              className="border-border/80 bg-background/50 text-foreground"
              min={1}
              max={900}
              value={config.timeout}
              onChange={(e) => patch({ timeout: Number(e.target.value) })}
            />
            <FieldError message={validationErrors.timeout} />
          </div>

          {/* Description */}
          <div>
            <label className="input-label">Description</label>
            <Input
              type="text"
              className="border-border/80 bg-background/50 text-foreground"
              value={config.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
            <FieldError message={validationErrors.description} />
          </div>
        </div>
      </section>

      {/* ── Function Code Section ─────────────────────────────── */}
      <section>
        <SectionHeader>Function Code</SectionHeader>
        <div>
          <label className="input-label">Source</label>
          <textarea
            className="border-border/80 bg-background/50 w-full resize-y rounded-md border px-3 py-2.5 font-mono text-xs text-foreground shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            style={{
              minHeight: 200,
              fontFamily: "'JetBrains Mono', monospace",
            }}
            value={config.code}
            onChange={(e) => patch({ code: e.target.value })}
          />
          <div className="mt-1 flex items-center justify-between">
            <FieldError message={validationErrors.code} />
            <span className="ml-auto text-[10px] text-muted-foreground">
              {config.code.length} chars
            </span>
          </div>
        </div>
      </section>

      {/* ── Environment Variables Section ──────────────────────── */}
      <section>
        <SectionHeader>Environment Variables</SectionHeader>
        <div className="space-y-2">
          {config.environmentVariables.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2">
              <Input
                type="text"
                className="border-border/80 bg-background/50 text-foreground"
                placeholder="KEY"
                value={entry.key}
                onChange={(e) =>
                  handleEnvChange(entry.id, 'key', e.target.value)
                }
              />
              <Input
                type="text"
                className="border-border/80 bg-background/50 text-foreground"
                placeholder="Value"
                value={entry.value}
                onChange={(e) =>
                  handleEnvChange(entry.id, 'value', e.target.value)
                }
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => removeEnvVariable(entry.id)}
                className="hover:bg-destructive/10 size-9 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remove variable"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <FieldError message={validationErrors.environmentVariables} />
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={addEnvVariable}
            className="hover:bg-accent/40 mt-1 flex items-center gap-1.5 text-primary"
          >
            <Plus className="size-3.5" />
            Add variable
          </Button>
        </div>
      </section>
    </div>
  );
}
