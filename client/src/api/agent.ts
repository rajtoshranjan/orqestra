import { api } from './client';
import {
  camelToSnakeRecursive,
  snakeToCamelRecursive,
  unwrapListPayload,
} from './types';

import type { ServerResponse } from './types';

export type AgentRiskLevel = 'safe' | 'confirm';

export type AgentRunStatusValue =
  | 'running'
  | 'awaiting_client'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentCatalogEntry = {
  id: string;
  name: string;
  category: string;
  capabilities?: {
    provides?: string[];
    requires?: string[];
    optional?: string[];
  };
  allowedParents?: string[];
  allowedRelationships?: string[];
  isContainer?: boolean;
  summary?: string;
  role?: string;
  useCases?: string[];
};

export type AgentOperation = {
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
  risk: AgentRiskLevel;
};

export type AgentOperationResult = {
  toolCallId: string;
  content: string;
  isError: boolean;
};

export type AgentAdvanceResponse = {
  runId: string;
  status: AgentRunStatusValue;
  assistantText: string;
  operations: AgentOperation[];
  error?: string;
};

export type AgentRun = {
  id: string;
  conversation: string;
  status: AgentRunStatusValue;
  turnCount: number;
  inputTokens: number;
  outputTokens: number;
  error: string;
  /** Tool calls still waiting on this client, so another surface can resume. */
  operations: AgentOperation[];
};

export type AgentMessageBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_call';
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: 'tool_result';
      tool_call_id: string;
      content: string;
      is_error: boolean;
    };

export type AgentConversationMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: AgentMessageBlock[];
};

/** Live canvas snapshot (persisted snake_case shape) sent so the agent's prompt
 * reflects exactly what's on the user's canvas right now. */
export type AgentGraphSnapshot = { nodes: unknown[]; edges: unknown[] };

/**
 * Map the response envelope with the shared mapper, but leave each operation's `input`
 * exactly as the model produced it: those keys are the tool schema's
 * (`service_id`, `config_patch`) and the config values inside are the service's
 * own, so translating either would break the executor that reads them.
 */
/** Runs carry operations too, whose `input` must survive casing untouched. */
function mapRun(raw: Record<string, unknown>): AgentRun {
  const mapped = snakeToCamelRecursive(raw) as AgentRun;
  const rawOperations = (raw.operations ?? []) as {
    input?: Record<string, unknown>;
  }[];
  return {
    ...mapped,
    operations: (mapped.operations ?? []).map((operation, index) => ({
      ...operation,
      input: rawOperations[index]?.input ?? {},
    })),
  };
}

function mapAdvance(data: unknown): AgentAdvanceResponse {
  const raw = (data ?? {}) as {
    operations?: { input?: Record<string, unknown> }[];
  };
  const mapped = snakeToCamelRecursive(data) as {
    runId: string;
    status: AgentRunStatusValue;
    assistantText: string;
    operations?: AgentOperation[];
    error?: string;
  };
  const operations = (mapped.operations ?? []).map((operation, index) => ({
    ...operation,
    input: raw.operations?.[index]?.input ?? {},
  }));
  return { ...mapped, operations };
}

export async function createAgentConversation(params: {
  projectId: string;
  catalog: AgentCatalogEntry[];
  /** Anchor the conversation to a canvas comment thread. Omit for build chats. */
  annotationId?: string;
}): Promise<{ id: string; projectId: string; status: string }> {
  const response = await api.post<ServerResponse<Record<string, unknown>>>(
    '/agent/conversations/',
    {
      project: params.projectId,
      catalog: params.catalog,
      ...(params.annotationId ? { annotation: params.annotationId } : {}),
    },
  );
  const data = snakeToCamelRecursive(response.data.data) as {
    id: string;
    project: string;
    status: string;
  };
  return { id: data.id, projectId: data.project, status: data.status };
}

type ConversationSummary = { id: string; createdAt: string };

async function listConversations(
  query: string,
): Promise<ConversationSummary[]> {
  const response = await api.get<ServerResponse<unknown>>(
    `/agent/conversations/?${query}`,
  );
  return snakeToCamelRecursive(
    unwrapListPayload(response.data.data),
  ) as ConversationSummary[];
}

/** Newest conversation in a listing, or null when there is none. */
function newest(results: ConversationSummary[]): ConversationSummary | null {
  if (results.length === 0) return null;
  return [...results].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

/**
 * Resolve the conversation already anchored to an annotation thread, so a
 * follow-up `@orqestra` reply reuses it and the agent keeps its memory of the
 * thread. Returns null when the thread has no conversation yet.
 */
export async function fetchConversationForAnnotation(
  annotationId: string,
): Promise<string | null> {
  const latest = newest(await listConversations(`annotation=${annotationId}`));
  return latest?.id ?? null;
}

export type RehydratedConversation = {
  id: string;
  messages: AgentConversationMessage[];
  /** A run still waiting on this client, if the last session left one behind. */
  activeRun: AgentRun | null;
};

/**
 * Load the most recent conversation for a project — its message history and any
 * run still in flight — so the panel can rehydrate after a reload or a
 * close/reopen. Returns null when the project has no agent conversation yet.
 */
export async function fetchLatestConversation(
  projectId: string,
): Promise<RehydratedConversation | null> {
  const latest = newest(
    await listConversations(`project=${projectId}&standalone=true`),
  );
  if (!latest) return null;

  const detail = await api.get<ServerResponse<Record<string, unknown>>>(
    `/agent/conversations/${latest.id}/`,
  );
  const raw = detail.data.data as {
    id: string;
    messages?: AgentConversationMessage[];
    active_run?: Record<string, unknown> | null;
  };
  return {
    id: raw.id,
    // Content blocks keep their wire shape; only the envelope is mapped.
    messages: raw.messages ?? [],
    activeRun: raw.active_run ? mapRun(raw.active_run) : null,
  };
}

export async function sendAgentMessage(
  conversationId: string,
  message: string,
  graph?: AgentGraphSnapshot,
  signal?: AbortSignal,
): Promise<AgentAdvanceResponse> {
  const response = await api.post<ServerResponse<unknown>>(
    `/agent/conversations/${conversationId}/send/`,
    { message, ...(graph ? { graph } : {}) },
    { signal },
  );
  return mapAdvance(response.data.data);
}

/**
 * Post the agent's reply into a comment thread. The body is derived server-side
 * from the run that produced it — a comment carrying the agent's name has to be
 * something the agent actually said.
 */
export async function replyToAnnotation(
  annotationId: string,
  runId: string,
): Promise<void> {
  await api.post(`/agent/annotations/${annotationId}/reply/`, { run: runId });
}

export async function advanceAgentRun(
  runId: string,
  operationResults: AgentOperationResult[],
  graph?: AgentGraphSnapshot,
  signal?: AbortSignal,
): Promise<AgentAdvanceResponse> {
  const response = await api.post<ServerResponse<unknown>>(
    `/agent/runs/${runId}/advance/`,
    {
      operation_results: camelToSnakeRecursive(operationResults),
      ...(graph ? { graph } : {}),
    },
    { signal },
  );
  return mapAdvance(response.data.data);
}

/**
 * The run still in flight on an annotation thread, if any — so a follow-up
 * comment can answer a pending confirmation instead of starting a second run.
 */
export async function fetchActiveRunForAnnotation(
  annotationId: string,
): Promise<AgentRun | null> {
  const conversationId = await fetchConversationForAnnotation(annotationId);
  if (!conversationId) return null;

  const detail = await api.get<ServerResponse<Record<string, unknown>>>(
    `/agent/conversations/${conversationId}/`,
  );
  const raw = (
    detail.data.data as { active_run?: Record<string, unknown> | null }
  ).active_run;
  return raw ? mapRun(raw) : null;
}

/** Stop a run the user no longer wants. The engine checks before each turn. */
export async function cancelAgentRun(runId: string): Promise<void> {
  await api.post(`/agent/runs/${runId}/cancel/`, {});
}
