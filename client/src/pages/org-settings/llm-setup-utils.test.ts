import { describe, expect, it } from 'vitest';

import { LLM_PROVIDERS, type LLMConfig } from '@/api/llm-configs';

import {
  connectionProblem,
  initialLLMForm,
  PROVIDER_SETUP,
  selectedModelPayload,
} from './llm-setup-utils';

const SAVED: LLMConfig = {
  id: 'saved-config',
  name: 'Team model',
  provider: 'openai',
  model: 'gpt-4.1',
  hasApiKey: true,
  baseUrl: 'https://api.openai.com/v1',
  contextWindow: 0,
  isDefault: true,
  createdAt: '',
  updatedAt: '',
};
const MODELS = [
  { id: 'gpt-4.1', name: 'GPT 4.1' },
  { id: 'gpt-4.1-mini', name: 'GPT 4.1 mini' },
];

describe('LLM setup', () => {
  it('shows the subscription access note only for OpenAI via provider metadata', () => {
    expect(
      LLM_PROVIDERS.filter(
        (provider) => PROVIDER_SETUP[provider].showOpenAIAccessNote,
      ),
    ).toEqual(['openai']);
  });

  it('does not invent a default model before discovery', () => {
    const form = initialLLMForm('openai');
    expect(selectedModelPayload(form, [], false).model).toBe('');
  });

  it('uses discovered IDs and names without manual typing', () => {
    const result = selectedModelPayload(
      initialLLMForm('openai'),
      MODELS,
      false,
    );
    expect(result.model).toBe('gpt-4.1');
    expect(result.name).toBe('GPT 4.1');
  });

  it('preserves a chosen model and custom display name', () => {
    const result = selectedModelPayload(
      {
        ...initialLLMForm('openai'),
        model: 'gpt-4.1-mini',
        name: ' Budget model ',
      },
      MODELS,
      false,
    );
    expect(result.model).toBe('gpt-4.1-mini');
    expect(result.name).toBe('Budget model');
  });

  it('does not force saved or custom IDs into the discovered catalog', () => {
    const form = { ...initialLLMForm('openai'), model: 'my-custom-model' };
    expect(selectedModelPayload(form, MODELS, false).model).toBe(
      'my-custom-model',
    );
    expect(selectedModelPayload(form, MODELS, true).name).toBe(
      'my-custom-model',
    );
    expect(
      selectedModelPayload(initialLLMForm('openai'), MODELS, true).model,
    ).toBe('');
  });

  it('requires hosted credentials but accepts a saved source', () => {
    const form = initialLLMForm('openai');
    expect(connectionProblem(form)).toContain('API key');
    expect(connectionProblem({ ...form, apiKey: '  ' })).toContain('API key');
    expect(connectionProblem(form, SAVED)).toBeNull();
    expect(connectionProblem(form, { ...SAVED, hasApiKey: false })).toContain(
      'API key',
    );
  });

  it('allows keyless local Ollama but requires an endpoint', () => {
    const form = initialLLMForm('ollama');
    expect(connectionProblem(form)).toContain('endpoint');
    expect(
      connectionProblem({
        ...form,
        baseUrl: 'http://host.docker.internal:11434',
      }),
    ).toBeNull();
  });

  it('initializes edits without exposing or inventing a credential', () => {
    expect(initialLLMForm('openai', SAVED)).toMatchObject({
      name: 'Team model',
      model: 'gpt-4.1',
      apiKey: '',
    });
  });
});
