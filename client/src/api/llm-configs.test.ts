import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  api: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from './client';
import { testLLMConnection } from './llm-configs';

const post = api.post as unknown as ReturnType<typeof vi.fn>;

describe('llm config api', () => {
  beforeEach(() => {
    post.mockReset();
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
