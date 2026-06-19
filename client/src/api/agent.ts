import { api } from './client';

import type { ServerResponse } from './types';

export type AgentRiskLevel = 'safe' | 'confirm';

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

export type AgentOp = {
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
  risk: AgentRiskLevel;
};

export type AgentOpResult = {
  toolCallId: string;
  content: string;
  isError: boolean;
};

export type AgentAdvanceResponse = {
  runId: string;
  status: string;
  assistantText: string;
  ops: AgentOp[];
  error?: string;
};

type RawOp = {
  tool_call_id: string;
  name: string;
  input: Record<string, unknown>;
  risk: AgentRiskLevel;
};

type RawAdvance = {
  run_id: string;
  status: string;
  assistant_text: string;
  ops: RawOp[];
  error?: string;
};

type RawConversation = { id: string; project: string; status: string };

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

type RawConversationSummary = { id: string; created_at: string };
type RawConversationDetail = {
  id: string;
  messages: AgentConversationMessage[];
};

function mapAdvance(data: RawAdvance): AgentAdvanceResponse {
  return {
    runId: data.run_id,
    status: data.status,
    assistantText: data.assistant_text,
    ops: (data.ops ?? []).map((op) => ({
      toolCallId: op.tool_call_id,
      name: op.name,
      input: op.input,
      risk: op.risk,
    })),
    error: data.error,
  };
}

export async function createAgentConversation(params: {
  projectId: string;
  catalog: AgentCatalogEntry[];
}): Promise<{ id: string; projectId: string; status: string }> {
  const response = await api.post<ServerResponse<RawConversation>>(
    '/agent/conversations/',
    { project: params.projectId, catalog: params.catalog },
  );
  const data = response.data.data;
  return { id: data.id, projectId: data.project, status: data.status };
}

/** Live canvas snapshot (persisted snake_case shape) sent so the agent's prompt
 * reflects exactly what's on the user's canvas right now. */
export type AgentGraphSnapshot = { nodes: unknown[]; edges: unknown[] };

/**
 * Load the most recent conversation for a project (with its full message
 * history) so the panel can rehydrate after a reload or a close/reopen.
 * Returns null when the project has no agent conversation yet.
 */
export async function fetchLatestConversation(
  projectId: string,
): Promise<{ id: string; messages: AgentConversationMessage[] } | null> {
  const list = await api.get<
    ServerResponse<
      RawConversationSummary[] | { results: RawConversationSummary[] }
    >
  >(`/agent/conversations/?project=${projectId}`);
  const payload = list.data.data;
  const results = Array.isArray(payload) ? payload : (payload?.results ?? []);
  if (results.length === 0) return null;

  const latest = [...results].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  )[0];
  const detail = await api.get<ServerResponse<RawConversationDetail>>(
    `/agent/conversations/${latest.id}/`,
  );
  return { id: detail.data.data.id, messages: detail.data.data.messages ?? [] };
}

export async function sendAgentMessage(
  conversationId: string,
  message: string,
  graph?: AgentGraphSnapshot,
): Promise<AgentAdvanceResponse> {
  const response = await api.post<ServerResponse<RawAdvance>>(
    `/agent/conversations/${conversationId}/send/`,
    { message, ...(graph ? { graph } : {}) },
  );
  return mapAdvance(response.data.data);
}

export async function replyToAnnotation(
  annotationId: string,
  body: string,
): Promise<void> {
  await api.post(`/agent/annotations/${annotationId}/reply/`, { body });
}

export async function advanceAgentRun(
  runId: string,
  opResults: AgentOpResult[],
  graph?: AgentGraphSnapshot,
): Promise<AgentAdvanceResponse> {
  const response = await api.post<ServerResponse<RawAdvance>>(
    `/agent/runs/${runId}/advance/`,
    {
      op_results: opResults.map((result) => ({
        tool_call_id: result.toolCallId,
        content: result.content,
        is_error: result.isError,
      })),
      ...(graph ? { graph } : {}),
    },
  );
  return mapAdvance(response.data.data);
}
