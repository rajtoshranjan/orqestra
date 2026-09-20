import { useState } from 'react';

import type { LLMModel } from '@/api/llm-configs';
import { Button, Input, Select } from '@/components/ui';

type LLMModelPickerProps = {
  models: LLMModel[];
  value: string;
  manual: boolean;
  loaded: boolean;
  onChange: (model: string) => void;
  onToggleManual: () => void;
};

export function LLMModelPicker({
  models,
  value,
  manual,
  loaded,
  onChange,
  onToggleManual,
}: LLMModelPickerProps): React.JSX.Element {
  const [search, setSearch] = useState<string>('');
  const query = search.trim().toLowerCase();
  const filtered = models.filter((model) =>
    `${model.id} ${model.name}`.toLowerCase().includes(query),
  );
  const current = models.find((model) => model.id === value);
  const includeCurrent = value && !filtered.some((model) => model.id === value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="llm-model" className="text-sm font-medium">
          2. Choose a model
        </label>
        <Button variant="link" size="sm" onClick={onToggleManual}>
          {manual ? 'Use model list' : 'Enter a model ID manually'}
        </Button>
      </div>
      {manual ? (
        <Input
          id="llm-model"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Exact model ID (advanced)"
          className="font-mono"
        />
      ) : (
        <>
          {models.length > 0 && (
            <Input
              aria-label="Search available models"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search models…"
            />
          )}
          <Select
            id="llm-model"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={!models.length && !value}
          >
            {!value && <option value="">Load models to choose one</option>}
            {includeCurrent && (
              <option value={value}>{current?.name ?? value}</option>
            )}
            {filtered.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name === model.id
                  ? model.id
                  : `${model.name} · ${model.id}`}
              </option>
            ))}
          </Select>
          {loaded && models.length === 0 && (
            <p role="status" className="text-xs text-muted-foreground">
              No compatible models were returned. Check model access or install
              a tool-capable Ollama model, then reload. You can also enter an ID
              manually.
            </p>
          )}
          {models.length > 0 && filtered.length === 0 && (
            <p role="status" className="text-xs text-muted-foreground">
              No matches. Your current selection is unchanged.
            </p>
          )}
        </>
      )}
    </div>
  );
}
