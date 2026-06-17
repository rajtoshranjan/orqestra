import { useCallback, useRef, useState } from 'react';

import {
  advanceAgentRun,
  createAgentConversation,
  sendAgentMessage,
} from '@/api/agent';
import { makeId } from '@/utils/diagram';

import { buildAgentCatalog } from './catalog';
import { type GraphState } from './op-executor';
import { applyConfirmedOp, processOps } from './run-loop';

import type { AgentAdvanceResponse, AgentOp, AgentOpResult } from '@/api/agent';

export type AgentChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export type AgentRunStatus = 'idle' | 'thinking' | 'awaiting_confirm' | 'error';

export type UseAgentRunOptions = {
  projectId: string;
  getGraph: () => GraphState;
  applyGraph: (next: GraphState) => void;
};

export function useAgentRun({ projectId, getGraph, applyGraph }: UseAgentRunOptions) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [status, setStatus] = useState<AgentRunStatus>('idle');
  const [pendingOp, setPendingOp] = useState<AgentOp | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const pendingResultsRef = useRef<AgentOpResult[]>([]);
  const remainingRef = useRef<AgentOp[]>([]);

  const appendAssistant = useCallback((text: string) => {
    if (!text) return;
    setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text }]);
  }, []);

  // Drive the client loop: process each turn's ops, report results, repeat
  // until the run completes or an op needs confirmation.
  const drive = useCallback(
    async (initial: AgentAdvanceResponse) => {
      let response = initial;
      for (;;) {
        runIdRef.current = response.runId;
        appendAssistant(response.assistantText);

        if (response.status !== 'awaiting_client' || response.ops.length === 0) {
          setStatus('idle');
          return;
        }

        const outcome = processOps(response.ops, getGraph());
        applyGraph(outcome.state);

        if (outcome.pending) {
          pendingResultsRef.current = outcome.results;
          remainingRef.current = outcome.pending.remaining;
          setPendingOp(outcome.pending.op);
          setStatus('awaiting_confirm');
          return;
        }

        response = await advanceAgentRun(response.runId, outcome.results);
      }
    },
    [appendAssistant, getGraph, applyGraph],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === 'thinking') return;

      setMessages((prev) => [...prev, { id: makeId(), role: 'user', text: trimmed }]);
      setStatus('thinking');
      try {
        if (!conversationIdRef.current) {
          const conversation = await createAgentConversation({
            projectId,
            catalog: buildAgentCatalog(),
          });
          conversationIdRef.current = conversation.id;
        }
        const response = await sendAgentMessage(conversationIdRef.current, trimmed);
        await drive(response);
      } catch (error) {
        appendAssistant(`Something went wrong: ${String(error)}`);
        setStatus('error');
      }
    },
    [projectId, status, drive, appendAssistant],
  );

  const confirm = useCallback(
    async (approved: boolean) => {
      const op = pendingOp;
      if (!op) return;
      setPendingOp(null);
      setStatus('thinking');
      try {
        const applied = applyConfirmedOp(op, getGraph(), approved);
        applyGraph(applied.state);

        const outcome = processOps(remainingRef.current, applied.state);
        applyGraph(outcome.state);
        const results = [...pendingResultsRef.current, applied.result, ...outcome.results];

        if (outcome.pending) {
          pendingResultsRef.current = results;
          remainingRef.current = outcome.pending.remaining;
          setPendingOp(outcome.pending.op);
          setStatus('awaiting_confirm');
          return;
        }

        const runId = runIdRef.current;
        if (!runId) {
          setStatus('idle');
          return;
        }
        const next = await advanceAgentRun(runId, results);
        await drive(next);
      } catch (error) {
        appendAssistant(`Something went wrong: ${String(error)}`);
        setStatus('error');
      }
    },
    [pendingOp, getGraph, applyGraph, drive, appendAssistant],
  );

  return { messages, status, pendingOp, sendMessage, confirm };
}
