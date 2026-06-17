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
};

type RawConversation = { id: string; project: string; status: string };

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

export async function sendAgentMessage(
  conversationId: string,
  message: string,
): Promise<AgentAdvanceResponse> {
  const response = await api.post<ServerResponse<RawAdvance>>(
    `/agent/conversations/${conversationId}/send/`,
    { message },
  );
  return mapAdvance(response.data.data);
}

export async function advanceAgentRun(
  runId: string,
  opResults: AgentOpResult[],
): Promise<AgentAdvanceResponse> {
  const response = await api.post<ServerResponse<RawAdvance>>(
    `/agent/runs/${runId}/advance/`,
    {
      op_results: opResults.map((result) => ({
        tool_call_id: result.toolCallId,
        content: result.content,
        is_error: result.isError,
      })),
    },
  );
  return mapAdvance(response.data.data);
}
