import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LLMConfig, LLMModel } from '@/api/llm-configs';

import { NEW_CREDENTIALS } from './llm-setup-utils';
import { useLLMSetup } from './use-llm-setup';

type Setup = ReturnType<typeof useLLMSetup>;
type ApiResponse = { data: { data: unknown } };
type HttpRequest = (url: string, payload: unknown) => Promise<ApiResponse>;

const HTTP = vi.hoisted(() => ({
  post: vi.fn<HttpRequest>(),
  patch: vi.fn<HttpRequest>(),
}));
vi.mock('@/api/client', () => ({ api: HTTP }));

const SAVED: LLMConfig = {
  id: 'saved-config',
  name: 'Team model',
  provider: 'ollama',
  model: 'qwen3:8b',
  hasApiKey: true,
  baseUrl: 'https://ollama.com',
  contextWindow: 32768,
  isDefault: true,
  createdAt: '',
  updatedAt: '',
};
const ALTERNATE: LLMConfig = {
  ...SAVED,
  id: 'local-config',
  name: 'Local model',
  hasApiKey: false,
  baseUrl: 'http://host.docker.internal:11434',
  contextWindow: 65536,
  isDefault: false,
};
const CONFIGS: LLMConfig[] = [SAVED, ALTERNATE];
const CONFIGS_QUERY_KEY = ['llm-configs'];
const MODELS: LLMModel[] = [
  { id: 'qwen3:8b', name: 'Qwen 3 8B' },
  { id: 'qwen3:14b', name: 'Qwen 3 14B' },
];
const SERVER_CONFIG = {
  id: SAVED.id,
  name: SAVED.name,
  provider: SAVED.provider,
  model: SAVED.model,
  has_api_key: SAVED.hasApiKey,
  base_url: SAVED.baseUrl,
  context_window: SAVED.contextWindow,
  is_default: SAVED.isDefault,
  created_at: SAVED.createdAt,
  updated_at: SAVED.updatedAt,
};
const CONNECTION_CHANGES: { name: string; change: (setup: Setup) => void }[] = [
  {
    name: 'API key',
    change: (setup: Setup): void =>
      setup.changeForm({ apiKey: 'replacement-key' }),
  },
  {
    name: 'endpoint',
    change: (setup: Setup): void =>
      setup.changeForm({ baseUrl: ALTERNATE.baseUrl }),
  },
  {
    name: 'source',
    change: (setup: Setup): void => setup.changeSource(ALTERNATE.id),
  },
];
const CLEANUPS: (() => void)[] = [];

type SetupHarness = {
  readonly current: Setup;
  queryClient: QueryClient;
  onSaved: ReturnType<typeof vi.fn<() => void>>;
};

function renderSetup(editing?: LLMConfig): SetupHarness {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  queryClient.setQueryData(CONFIGS_QUERY_KEY, CONFIGS);
  const onSaved = vi.fn<() => void>();
  let current: Setup;
  let renderer: ReactTestRenderer;

  function Harness(): null {
    current = useLLMSetup(SAVED.provider, CONFIGS, editing, onSaved);
    return null;
  }

  act((): void => {
    renderer = create(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  CLEANUPS.push((): void => {
    renderer.unmount();
    queryClient.clear();
  });
  return {
    get current(): Setup {
      return current;
    },
    queryClient,
    onSaved,
  };
}

function response(data: unknown): ApiResponse {
  return { data: { data } };
}

function deferredResponse(): {
  promise: Promise<ApiResponse>;
  resolve: (value: ApiResponse) => void;
  reject: (error: Error) => void;
} {
  let resolve: (value: ApiResponse) => void;
  let reject: (error: Error) => void;
  const promise = new Promise<ApiResponse>(
    (resolvePromise, rejectPromise): void => {
      resolve = resolvePromise;
      reject = rejectPromise;
    },
  );
  return {
    promise,
    resolve: (value: ApiResponse): void => resolve(value),
    reject: (error: Error): void => reject(error),
  };
}

async function flushNotifications(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<void>((resolve): void => {
      setTimeout(resolve, 0);
    });
  });
}

async function discover(
  harness: SetupHarness,
  models: LLMModel[] = MODELS,
): Promise<void> {
  HTTP.post.mockResolvedValueOnce(response({ ok: true, models }));
  act((): void => harness.current.loadModels());
  await vi.waitFor((): void => {
    expect(harness.current.discovery.isSuccess).toBe(true);
  });
}

async function testConnection(harness: SetupHarness): Promise<void> {
  HTTP.post.mockResolvedValueOnce(
    response({ ok: true, model: harness.current.payload.model }),
  );
  act((): void => harness.current.testModel());
  await vi.waitFor((): void => {
    expect(harness.current.test.isSuccess).toBe(true);
  });
}

beforeEach((): void => {
  HTTP.post.mockReset();
  HTTP.patch.mockReset();
  // React Query's timer-driven notifications must also commit inside act.
  notifyManager.setNotifyFunction((callback): void => {
    act(callback);
  });
});

afterEach((): void => {
  act((): void => {
    CLEANUPS.splice(0).forEach((cleanup): void => cleanup());
  });
  notifyManager.setNotifyFunction((callback): void => callback());
});

describe('useLLMSetup workflow', (): void => {
  it.each(CONNECTION_CHANGES)(
    'clears discovery, selection and test results when $name changes',
    async ({ change }): Promise<void> => {
      const harness = renderSetup();
      await discover(harness);
      await testConnection(harness);
      expect(harness.current.models).toEqual(MODELS);
      expect(harness.current.test.data?.ok).toBe(true);

      act((): void => change(harness.current));

      expect(harness.current.discovery.isIdle).toBe(true);
      expect(harness.current.test.isIdle).toBe(true);
      expect(harness.current.discovery.data).toBeUndefined();
      expect(harness.current.test.data).toBeUndefined();
      expect(harness.current.models).toEqual([]);
      expect(harness.current.payload.model).toBe('');
    },
  );

  it.each(CONNECTION_CHANGES)(
    'does not restore a late discovery response after $name changes',
    async ({ change }): Promise<void> => {
      const harness = renderSetup();
      const pending = deferredResponse();
      HTTP.post.mockReturnValueOnce(pending.promise);
      act((): void => harness.current.loadModels());
      await vi.waitFor((): void => {
        expect(harness.current.discovery.isPending).toBe(true);
      });
      const [mutation] = harness.queryClient.getMutationCache().getAll();

      act((): void => change(harness.current));
      pending.resolve(response({ ok: true, models: MODELS }));
      await vi.waitFor((): void => {
        expect(mutation.state.status).toBe('success');
      });
      await flushNotifications();

      expect(harness.current.discovery.isIdle).toBe(true);
      expect(harness.current.models).toEqual([]);
      expect(harness.current.payload.model).toBe('');
    },
  );

  it.each(CONNECTION_CHANGES)(
    'does not restore a late connection test after $name changes',
    async ({ change }): Promise<void> => {
      const harness = renderSetup();
      await discover(harness);
      const pending = deferredResponse();
      HTTP.post.mockReturnValueOnce(pending.promise);
      act((): void => harness.current.testModel());
      await vi.waitFor((): void => {
        expect(harness.current.test.isPending).toBe(true);
      });
      const mutation = harness.queryClient
        .getMutationCache()
        .find({ status: 'pending' });
      expect(mutation).toBeDefined();

      act((): void => change(harness.current));
      pending.resolve(response({ ok: true, model: SAVED.model }));
      await vi.waitFor((): void => {
        expect(mutation?.state.status).toBe('success');
      });
      await flushNotifications();

      expect(harness.current.test.isIdle).toBe(true);
      expect(harness.current.test.data).toBeUndefined();
    },
  );

  it.each([
    { outcome: 'succeeds', succeeded: true },
    { outcome: 'fails', succeeded: false },
  ])(
    'keeps a newer catalog when an old discovery request $outcome late',
    async ({ succeeded }): Promise<void> => {
      const harness = renderSetup();
      const pending = deferredResponse();
      HTTP.post.mockReturnValueOnce(pending.promise);
      act((): void => harness.current.loadModels());
      await vi.waitFor((): void => {
        expect(harness.current.discovery.isPending).toBe(true);
      });
      const [mutation] = harness.queryClient.getMutationCache().getAll();
      act((): void => harness.current.changeSource(ALTERNATE.id));
      const models: LLMModel[] = [{ id: 'local:latest', name: 'Local' }];
      await discover(harness, models);

      if (succeeded) {
        pending.resolve(response({ ok: true, models: MODELS }));
      } else {
        pending.reject(new Error('Old endpoint disconnected'));
      }
      await vi.waitFor((): void => {
        expect(mutation.state.status).toBe(succeeded ? 'success' : 'error');
      });
      await flushNotifications();

      expect(harness.current.models).toEqual(models);
      expect(harness.current.discovery.error).toBeNull();
      expect(harness.current.payload.model).toBe(models[0].id);
      expect(HTTP.post).toHaveBeenLastCalledWith(
        '/organisations/llm-configs/models/',
        {
          provider: SAVED.provider,
          base_url: ALTERNATE.baseUrl,
          config: ALTERNATE.id,
        },
      );
    },
  );

  it('switches to the saved source endpoint/context and clears an entered key', (): void => {
    const harness = renderSetup();
    act((): void =>
      harness.current.changeForm({ apiKey: 'typed-key', name: 'Draft' }),
    );
    act((): void => harness.current.changeSource(ALTERNATE.id));
    expect(harness.current.source).toEqual(ALTERNATE);
    expect(harness.current.form).toMatchObject({
      apiKey: '',
      name: '',
      model: '',
      baseUrl: ALTERNATE.baseUrl,
      contextWindow: ALTERNATE.contextWindow,
    });
    act((): void => harness.current.changeSource(NEW_CREDENTIALS));
    expect(harness.current.source).toBeUndefined();
    expect(harness.current.form.baseUrl).toBe('');
    expect(harness.current.form.contextWindow).toBe(0);
  });

  it('posts a selected model with a saved source and invalidates the config query', async (): Promise<void> => {
    const harness = renderSetup();
    await discover(harness);
    expect(harness.current.form.model).toBe('');
    expect(harness.current.payload.model).toBe(MODELS[0].id);
    act((): void => harness.current.changeForm({ model: MODELS[1].id }));
    HTTP.post.mockResolvedValueOnce(response(SERVER_CONFIG));

    await act(async (): Promise<void> => {
      await harness.current.save();
    });

    expect(HTTP.post).toHaveBeenLastCalledWith('/organisations/llm-configs/', {
      name: MODELS[1].name,
      provider: SAVED.provider,
      model: MODELS[1].id,
      base_url: SAVED.baseUrl,
      context_window: SAVED.contextWindow,
      config: SAVED.id,
    });
    expect(HTTP.patch).not.toHaveBeenCalled();
    expect(harness.onSaved).toHaveBeenCalledOnce();
    expect(
      harness.queryClient.getQueryState(CONFIGS_QUERY_KEY)?.isInvalidated,
    ).toBe(true);
  });

  it('tests an edited model with its saved key, then patches without a credential source or blank key', async (): Promise<void> => {
    const harness = renderSetup(SAVED);
    expect(harness.current.form.apiKey).toBe('');
    act((): void =>
      harness.current.changeForm({
        model: MODELS[1].id,
        name: ' Updated model ',
      }),
    );
    await testConnection(harness);
    const body = {
      name: 'Updated model',
      provider: SAVED.provider,
      model: MODELS[1].id,
      base_url: SAVED.baseUrl,
      context_window: SAVED.contextWindow,
    };
    expect(HTTP.post).toHaveBeenLastCalledWith(
      '/organisations/llm-configs/test/',
      { ...body, config: SAVED.id },
    );
    HTTP.patch.mockResolvedValueOnce(response(SERVER_CONFIG));

    await act(async (): Promise<void> => {
      await harness.current.save();
    });

    expect(HTTP.patch).toHaveBeenCalledExactlyOnceWith(
      `/organisations/llm-configs/${SAVED.id}/`,
      body,
    );
    expect(harness.onSaved).toHaveBeenCalledOnce();
    expect(
      harness.queryClient.getQueryState(CONFIGS_QUERY_KEY)?.isInvalidated,
    ).toBe(true);
  });

  it('posts a manual model with trimmed new credentials and no saved source', async (): Promise<void> => {
    const harness = renderSetup();
    act((): void => harness.current.changeSource(NEW_CREDENTIALS));
    act((): void => harness.current.changeManual());
    act((): void =>
      harness.current.changeForm({
        apiKey: ' new-key ',
        baseUrl: ' https://models.example ',
      }),
    );
    act((): void =>
      harness.current.changeForm({
        model: ' custom:model ',
        contextWindow: 16384,
      }),
    );
    HTTP.post.mockResolvedValueOnce(response(SERVER_CONFIG));

    await act(async (): Promise<void> => {
      await harness.current.save();
    });

    expect(HTTP.post).toHaveBeenCalledExactlyOnceWith(
      '/organisations/llm-configs/',
      {
        name: 'custom:model',
        provider: SAVED.provider,
        model: 'custom:model',
        api_key: 'new-key',
        base_url: 'https://models.example',
        context_window: 16384,
      },
    );
    expect(harness.onSaved).toHaveBeenCalledOnce();
  });

  it('requires an explicit manual ID and resets testing when switching between manual and discovered selections', async (): Promise<void> => {
    const harness = renderSetup();
    await discover(harness);
    act((): void => harness.current.changeForm({ model: MODELS[1].id }));
    await testConnection(harness);
    act((): void => harness.current.changeManual());
    expect(harness.current.manual).toBe(true);
    expect(harness.current.payload.model).toBe('');
    expect(harness.current.models).toEqual(MODELS);
    expect(harness.current.test.isIdle).toBe(true);
    HTTP.post.mockClear();
    act((): void => harness.current.testModel());
    await act(async (): Promise<void> => {
      await harness.current.save();
    });
    expect(HTTP.post).not.toHaveBeenCalled();
    expect(harness.current.problem).toBe('Choose a model first.');

    act((): void => harness.current.changeForm({ model: 'custom:model' }));
    await testConnection(harness);
    expect(harness.current.payload.name).toBe('custom:model');
    expect(harness.current.problem).toBeNull();
    act((): void => harness.current.changeManual());
    expect(harness.current.manual).toBe(false);
    expect(harness.current.payload.model).toBe(MODELS[0].id);
    expect(harness.current.test.isIdle).toBe(true);
  });
});
