import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './client';

import type { ServerResponse } from './types';

/** Providers the server has an adapter for (server/agent/llm/). */
export const LLM_PROVIDERS = [
  'openai',
  'anthropic',
  'gemini',
  'ollama',
] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

/** Providers that authenticate with an API key. Local Ollama needs none. */
export const PROVIDERS_REQUIRING_KEY: readonly LLMProvider[] = [
  'openai',
  'anthropic',
  'gemini',
];

/** Providers reached at an operator-supplied address rather than a vendor one. */
export const PROVIDERS_REQUIRING_BASE_URL: readonly LLMProvider[] = ['ollama'];

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  ollama: 'Ollama',
};

type ServerLLMConfig = {
  id: string;
  name: string;
  provider: LLMProvider;
  model: string;
  has_api_key: boolean;
  base_url: string;
  context_window: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

type ServerLLMConfigPayload = {
  name: string;
  provider: LLMProvider;
  model: string;
  api_key?: string;
  base_url?: string;
  context_window?: number;
  is_default?: boolean;
  config?: string;
};

export type LLMConfig = {
  id: string;
  name: string;
  provider: LLMProvider;
  model: string;
  /** The key itself is never returned — only whether one is stored. */
  hasApiKey: boolean;
  baseUrl: string;
  contextWindow: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateLLMConfigPayload = {
  name: string;
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  contextWindow?: number;
  isDefault?: boolean;
  /** Reuse credentials from an existing, organisation-owned configuration. */
  configId?: string;
};

export type UpdateLLMConfigPayload = Partial<CreateLLMConfigPayload>;

export type LLMModel = {
  id: string;
  name: string;
};

export type LLMDiscoveryPayload = Pick<
  CreateLLMConfigPayload,
  'provider' | 'apiKey' | 'baseUrl' | 'configId'
>;

export type LLMDiscoveryResult =
  | { ok: true; models: LLMModel[] }
  | { ok: false; error: string };

export type LLMConnectionResult = {
  ok: boolean;
  model?: string;
  error?: string;
};

const mapServerLLMConfigToClient = (server: ServerLLMConfig): LLMConfig => ({
  id: server.id,
  name: server.name,
  provider: server.provider,
  model: server.model,
  hasApiKey: server.has_api_key,
  baseUrl: server.base_url ?? '',
  contextWindow: server.context_window ?? 0,
  isDefault: server.is_default,
  createdAt: server.created_at,
  updatedAt: server.updated_at,
});

const mapPayloadToServer = (
  payload: UpdateLLMConfigPayload,
): Partial<ServerLLMConfigPayload> => {
  const server: Partial<ServerLLMConfigPayload> = {};
  if (payload.name !== undefined) server.name = payload.name;
  if (payload.provider !== undefined) server.provider = payload.provider;
  if (payload.model !== undefined) server.model = payload.model;
  // An omitted key means "keep the stored one" — never send a blank over it.
  if (payload.apiKey) server.api_key = payload.apiKey;
  if (payload.baseUrl !== undefined) server.base_url = payload.baseUrl;
  if (payload.contextWindow !== undefined)
    server.context_window = payload.contextWindow;
  if (payload.isDefault !== undefined) server.is_default = payload.isDefault;
  if (payload.configId) server.config = payload.configId;
  return server;
};

const fetchLLMConfigs = async (): Promise<LLMConfig[]> => {
  const response = await api.get<ServerResponse<ServerLLMConfig[]>>(
    '/organisations/llm-configs/',
  );
  return response.data.data.map(mapServerLLMConfigToClient);
};

export const createLLMConfig = async (
  payload: CreateLLMConfigPayload,
): Promise<LLMConfig> => {
  const response = await api.post<ServerResponse<ServerLLMConfig>>(
    '/organisations/llm-configs/',
    mapPayloadToServer(payload),
  );
  return mapServerLLMConfigToClient(response.data.data);
};

const updateLLMConfig = async (
  configId: string,
  payload: UpdateLLMConfigPayload,
): Promise<LLMConfig> => {
  const response = await api.patch<ServerResponse<ServerLLMConfig>>(
    `/organisations/llm-configs/${configId}/`,
    mapPayloadToServer(payload),
  );
  return mapServerLLMConfigToClient(response.data.data);
};

const deleteLLMConfig = async (configId: string): Promise<void> => {
  await api.delete(`/organisations/llm-configs/${configId}/`);
};

/**
 * Dial the provider once to check a credential before saving it. A refused key
 * comes back as `ok: false`, not a thrown error — it's a valid answer.
 */
export const testLLMConnection = async (
  payload: CreateLLMConfigPayload & { configId?: string },
): Promise<LLMConnectionResult> => {
  const response = await api.post<ServerResponse<LLMConnectionResult>>(
    '/organisations/llm-configs/test/',
    mapPayloadToServer(payload),
  );
  return response.data.data;
};

/** Fetch the live catalog without sending a prompt or storing credentials. */
export const discoverLLMModels = async (
  payload: LLMDiscoveryPayload,
): Promise<LLMDiscoveryResult> => {
  const response = await api.post<ServerResponse<LLMDiscoveryResult>>(
    '/organisations/llm-configs/models/',
    mapPayloadToServer(payload),
  );
  return response.data.data;
};

export const useLLMConfigs = (enabled = true) =>
  useQuery({ queryKey: ['llm-configs'], queryFn: fetchLLMConfigs, enabled });

const invalidate = (queryClient: ReturnType<typeof useQueryClient>) => () => {
  void queryClient.invalidateQueries({ queryKey: ['llm-configs'] });
};

export const useCreateLLMConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLLMConfig,
    onSuccess: invalidate(queryClient),
  });
};

export const useUpdateLLMConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      configId,
      data,
    }: {
      configId: string;
      data: UpdateLLMConfigPayload;
    }) => updateLLMConfig(configId, data),
    onSuccess: invalidate(queryClient),
  });
};

export const useDeleteLLMConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteLLMConfig,
    onSuccess: invalidate(queryClient),
  });
};
