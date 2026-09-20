import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  api: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from './client';
import {
  createLLMConfig,
  discoverLLMModels,
  testLLMConnection,
} from './llm-configs';

const post = api.post as unknown as ReturnType<typeof vi.fn>;

describe('llm config api', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('discovers models without a model id or display name', async () => {
    const result = { ok: true, models: [{ id: 'gpt-4.1', name: 'gpt-4.1' }] };
    post.mockResolvedValue({ data: { data: result } });

    expect(
      await discoverLLMModels({ provider: 'openai', apiKey: 'test-key' }),
    ).toEqual(result);
    expect(post).toHaveBeenCalledWith('/organisations/llm-configs/models/', {
      provider: 'openai',
      api_key: 'test-key',
    });
  });

  it('reuses saved credentials for discovery without exposing a key', async () => {
    post.mockResolvedValue({ data: { data: { ok: true, models: [] } } });
    await discoverLLMModels({
      provider: 'ollama',
      configId: 'cfg-1',
      baseUrl: 'http://host.docker.internal:11434',
      apiKey: '',
    });
    expect(post).toHaveBeenCalledWith('/organisations/llm-configs/models/', {
      provider: 'ollama',
      config: 'cfg-1',
      base_url: 'http://host.docker.internal:11434',
    });
  });

  it('preserves discovery failures for actionable UI feedback', async () => {
    const result = { ok: false, error: 'The provider rejected the API key.' };
    post.mockResolvedValue({ data: { data: result } });
    expect(
      await discoverLLMModels({ provider: 'openai', apiKey: 'invalid' }),
    ).toEqual(result);
  });

  it('creates another model using a saved credential source', async () => {
    post.mockResolvedValue({
      data: {
        data: {
          id: 'cfg-2',
          name: 'Second model',
          provider: 'openai',
          model: 'gpt-4.1-mini',
          has_api_key: true,
          is_default: false,
        },
      },
    });
    const result = await createLLMConfig({
      name: 'Second model',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      configId: 'cfg-1',
    });
    expect(post).toHaveBeenCalledWith('/organisations/llm-configs/', {
      name: 'Second model',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      config: 'cfg-1',
    });
    expect(result.hasApiKey).toBe(true);
    expect(result).not.toHaveProperty('apiKey');
  });

  it('omits a blank api key so an edit never wipes the stored one', async () => {
    post.mockResolvedValue({ data: { data: { ok: true } } });

    await testLLMConnection({
      name: 'Claude',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      apiKey: '',
      configId: 'cfg-1',
    });

    const body = post.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty('api_key');
    expect(body.config).toBe('cfg-1');
  });

  it('sends a typed key when the form supplies one', async () => {
    post.mockResolvedValue({ data: { data: { ok: true } } });

    await testLLMConnection({
      name: 'Claude',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      apiKey: 'sk-ant-x',
    });

    const body = post.mock.calls[0][1] as Record<string, unknown>;
    expect(body.api_key).toBe('sk-ant-x');
  });

  it('returns a refused credential as a result, not a throw', async () => {
    post.mockResolvedValue({
      data: { data: { ok: false, error: '401 unauthorised' } },
    });

    const result = await testLLMConnection({
      name: 'Claude',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      apiKey: 'bad',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('401');
  });
});
