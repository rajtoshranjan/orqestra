import { ExternalLink, Plug, RefreshCw } from 'lucide-react';

import { describeAgentError } from '@/agent/errors';
import {
  PROVIDER_LABELS,
  PROVIDERS_REQUIRING_BASE_URL,
  PROVIDERS_REQUIRING_KEY,
  type LLMConfig,
  type LLMProvider,
} from '@/api/llm-configs';
import {
  Button,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
} from '@/components/ui';

import { LLMModelPicker } from './llm-model-picker';
import { NEW_CREDENTIALS, PROVIDER_SETUP } from './llm-setup-utils';
import { OpenAIAccessNote } from './openai-access-note';
import { useLLMSetup } from './use-llm-setup';

type LLMSetupDialogProps = {
  provider: LLMProvider;
  configs: LLMConfig[];
  editing?: LLMConfig;
  onClose: () => void;
};

export function LLMSetupDialog({
  provider,
  configs,
  editing,
  onClose,
}: LLMSetupDialogProps): React.JSX.Element {
  const setup = useLLMSetup(provider, configs, editing, onClose);
  const needsUrl = PROVIDERS_REQUIRING_BASE_URL.includes(provider);
  const needsKey = PROVIDERS_REQUIRING_KEY.includes(provider);
  const guide = PROVIDER_SETUP[provider];
  const error =
    setup.problem ||
    (setup.discovery.isError
      ? describeAgentError(setup.discovery.error)
      : null) ||
    (setup.discovery.data && !setup.discovery.data.ok
      ? setup.discovery.data.error
      : null) ||
    (setup.test.isError ? describeAgentError(setup.test.error) : null) ||
    (setup.test.data && !setup.test.data.ok ? setup.test.data.error : null);
  const busy =
    setup.saving || setup.test.isPending || setup.discovery.isPending;

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {editing ? 'Edit' : 'Connect'} {PROVIDER_LABELS[provider]}
        </DialogTitle>
        <DialogDescription>
          Connect once, load available models, then choose one. Keys are
          encrypted at rest and never returned to your browser. Agent prompts
          are sent to the selected provider.
        </DialogDescription>
      </DialogHeader>

      <fieldset disabled={busy} className="min-w-0 space-y-4">
        {guide.showOpenAIAccessNote && <OpenAIAccessNote />}
        <div className="space-y-2">
          <p className="text-sm font-medium">1. Connect your provider</p>
          {!editing && setup.connections.length > 0 && (
            <div className="space-y-1.5">
              <label
                htmlFor="llm-connection"
                className="text-xs text-muted-foreground"
              >
                Credentials
              </label>
              <Select
                id="llm-connection"
                value={setup.sourceId}
                onChange={(event) => setup.changeSource(event.target.value)}
              >
                <option value={NEW_CREDENTIALS}>Use a new connection</option>
                {setup.connections.map((config) => (
                  <option key={config.id} value={config.id}>
                    Reuse: {config.name}
                  </option>
                ))}
              </Select>
              {setup.source && (
                <p className="text-xs text-muted-foreground">
                  Reuses this saved connection without exposing its key. The new
                  model gets its own configuration.
                </p>
              )}
            </div>
          )}
          {needsUrl && (
            <div className="space-y-1.5">
              <label htmlFor="llm-base-url" className="text-xs font-medium">
                Endpoint URL
              </label>
              <Input
                id="llm-base-url"
                value={setup.form.baseUrl ?? ''}
                onChange={(event) =>
                  setup.changeForm({ baseUrl: event.target.value })
                }
                placeholder="http://host.docker.internal:11434"
              />
              <p className="text-xs text-muted-foreground">
                Use an address your server container can reach, or
                https://ollama.com for cloud. Changing a keyed endpoint requires
                a new key.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="llm-api-key" className="text-xs font-medium">
              API key{!needsKey && ' (optional for local Ollama)'}
            </label>
            <Input
              id="llm-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={setup.form.apiKey ?? ''}
              onChange={(event) =>
                setup.changeForm({ apiKey: event.target.value })
              }
              placeholder={
                setup.source?.hasApiKey
                  ? 'Leave blank to reuse the saved key'
                  : 'Paste your API key'
              }
            />
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <a href={guide.keyUrl} target="_blank" rel="noopener noreferrer">
                {guide.keyLabel}{' '}
                <ExternalLink size={12} className="ml-1" aria-hidden="true" />
              </a>
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={setup.loadModels}
            className="gap-1.5"
          >
            <RefreshCw size={13} aria-hidden="true" />
            {setup.discovery.isPending
              ? 'Loading models…'
              : setup.discovery.data?.ok
                ? 'Refresh models'
                : 'Load available models'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Lists models from your account or endpoint, without sending a
            prompt. Listing does not guarantee tool support; test your selection
            before use.
          </p>
        </div>

        <LLMModelPicker
          models={setup.models}
          value={setup.payload.model}
          manual={setup.manual}
          loaded={setup.discovery.data?.ok ?? false}
          onChange={(model) => setup.changeForm({ model })}
          onToggleManual={setup.changeManual}
        />

        <div className="space-y-1.5">
          <label htmlFor="llm-name" className="text-sm font-medium">
            Display name (optional)
          </label>
          <Input
            id="llm-name"
            value={setup.form.name}
            onChange={(event) => setup.changeForm({ name: event.target.value })}
            placeholder={setup.payload.name || 'Uses the selected model name'}
          />
        </div>
        {needsUrl && (
          <div className="space-y-1.5">
            <label htmlFor="llm-context" className="text-sm font-medium">
              Context window (local models)
            </label>
            <Input
              id="llm-context"
              type="number"
              min={0}
              step={1}
              value={setup.form.contextWindow || ''}
              onChange={(event) =>
                setup.changeForm({
                  contextWindow: Number(event.target.value) || 0,
                })
              }
              placeholder="32768"
            />
            <p className="text-xs text-muted-foreground">
              Use at least 32768 if your local model supports it. Leave blank
              for cloud models.
            </p>
          </div>
        )}
      </fieldset>

      {error && (
        <p
          role="alert"
          className="break-words rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      {setup.test.data?.ok && (
        <p
          role="status"
          className="border-success/40 bg-success/10 rounded-lg border p-3 text-xs text-success"
        >
          Connected. {setup.test.data.model} responded.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Test connection sends a small prompt and may incur provider charges.
      </p>
      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          variant="outline"
          onClick={setup.testModel}
          disabled={busy || !setup.payload.model}
          className="gap-1.5"
        >
          <Plug size={13} aria-hidden="true" />
          {setup.test.isPending ? 'Testing…' : 'Test connection'}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={setup.saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void setup.save()}
            disabled={busy || !setup.payload.model}
          >
            {setup.saving ? 'Saving…' : editing ? 'Save changes' : 'Save model'}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
