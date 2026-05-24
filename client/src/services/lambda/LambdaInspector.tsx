import { Plus, Trash2 } from 'lucide-react';
import type { ServiceInspectorProps } from '../types';
import type { LambdaConfig, LambdaRuntime } from './types';
import { RUNTIME_OPTIONS } from './types';
import {
  getDefaultHandlerForRuntime,
  getDefaultCodeForRuntime,
  makeEnvironmentVariable,
} from './defaults';

/* ─── Shared sub-components ───────────────────────────────────────────── */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </h3>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--color-error)]">{message}</p>;
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
            <input
              type="text"
              className="input-field w-full"
              value={config.functionName}
              onChange={(e) => patch({ functionName: e.target.value })}
            />
            <FieldError message={validationErrors.functionName} />
          </div>

          {/* Runtime */}
          <div>
            <label className="input-label">Runtime</label>
            <select
              className="input-field w-full"
              value={config.runtime}
              onChange={(e) =>
                handleRuntimeChange(e.target.value as LambdaRuntime)
              }
            >
              {RUNTIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FieldError message={validationErrors.runtime} />
          </div>

          {/* Handler */}
          <div>
            <label className="input-label">Handler</label>
            <input
              type="text"
              className="input-field w-full"
              value={config.handler}
              onChange={(e) => patch({ handler: e.target.value })}
            />
            <FieldError message={validationErrors.handler} />
          </div>

          {/* Memory Size */}
          <div>
            <label className="input-label">Memory (MB)</label>
            <input
              type="number"
              className="input-field w-full"
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
            <input
              type="number"
              className="input-field w-full"
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
            <input
              type="text"
              className="input-field w-full"
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
            className="duration-[var(--transition-fast)] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2.5 font-mono text-sm text-[var(--color-text-primary)] transition-shadow placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            style={{
              minHeight: 200,
              fontFamily: "'JetBrains Mono', monospace",
            }}
            value={config.code}
            onChange={(e) => patch({ code: e.target.value })}
          />
          <div className="mt-1 flex items-center justify-between">
            <FieldError message={validationErrors.code} />
            <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
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
              <input
                type="text"
                className="input-field min-w-0 flex-1"
                placeholder="KEY"
                value={entry.key}
                onChange={(e) =>
                  handleEnvChange(entry.id, 'key', e.target.value)
                }
              />
              <input
                type="text"
                className="input-field min-w-0 flex-1"
                placeholder="Value"
                value={entry.value}
                onChange={(e) =>
                  handleEnvChange(entry.id, 'value', e.target.value)
                }
              />
              <button
                onClick={() => removeEnvVariable(entry.id)}
                className="duration-[var(--transition-fast)] rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-error-subtle)] hover:text-[var(--color-error)]"
                aria-label="Remove variable"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <FieldError message={validationErrors.environmentVariables} />
          <button
            onClick={addEnvVariable}
            className="duration-[var(--transition-fast)] mt-1 flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add variable
          </button>
        </div>
      </section>
    </div>
  );
}
