import {
  PROVIDERS_REQUIRING_BASE_URL,
  PROVIDERS_REQUIRING_KEY,
  type CreateLLMConfigPayload,
  type LLMConfig,
  type LLMModel,
  type LLMProvider,
} from '@/api/llm-configs';

export const PROVIDER_SETUP: Record<
  LLMProvider,
  {
    description: string;
    keyUrl: string;
    keyLabel: string;
    showOpenAIAccessNote?: boolean;
  }
> = {
  openai: {
    description: 'GPT models with an OpenAI Platform API key.',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLabel: 'Get an OpenAI API key',
    showOpenAIAccessNote: true,
  },
  anthropic: {
    description: 'Claude models with an Anthropic API key.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyLabel: 'Get an Anthropic API key',
  },
  gemini: {
    description: 'Gemini models with a Google AI Studio API key.',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyLabel: 'Get a Gemini API key',
  },
  ollama: {
    description: 'Installed local models or an Ollama cloud endpoint.',
    keyUrl: 'https://ollama.com/settings/keys',
    keyLabel: 'Get an Ollama cloud API key',
  },
};

export const NEW_CREDENTIALS = 'new';

export function initialLLMForm(
  provider: LLMProvider,
  config?: LLMConfig,
): CreateLLMConfigPayload {
  return {
    provider,
    name: config?.name ?? '',
    model: config?.model ?? '',
    apiKey: '',
    baseUrl: config?.baseUrl ?? '',
    contextWindow: config?.contextWindow ?? 0,
  };
}

export function connectionProblem(
  form: CreateLLMConfigPayload,
  source?: LLMConfig,
): string | null {
  if (
    PROVIDERS_REQUIRING_KEY.includes(form.provider) &&
    !form.apiKey?.trim() &&
    !source?.hasApiKey
  ) {
    return 'Enter an API key or choose a saved connection.';
  }
  if (
    PROVIDERS_REQUIRING_BASE_URL.includes(form.provider) &&
    !form.baseUrl?.trim()
  ) {
    return 'Enter the endpoint URL your server can reach.';
  }
  return null;
}

/** A custom display name is optional; the discovered name is the default. */
export function selectedModelPayload(
  form: CreateLLMConfigPayload,
  models: LLMModel[],
  manual: boolean,
): CreateLLMConfigPayload {
  const model = form.model.trim() || (manual ? '' : (models[0]?.id ?? ''));
  const name =
    form.name.trim() ||
    models.find((entry) => entry.id === model)?.name ||
    model;
  return { ...form, model, name };
}
