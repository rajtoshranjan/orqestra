import { useCallback, useRef, useState } from 'react';

import {
  advanceAgentRun,
  createAgentConversation,
  sendAgentMessage,
} from '@/api/agent';
import { makeId } from '@/utils/diagram';

import { buildAgentCatalog } from './catalog';
import { describeOp, type AgentOpIcon } from './op-label';
import { executeOp, type GraphState } from './op-executor';
import { resolveOpRisk } from './risk';
import { applyConfirmedOp } from './run-loop';

import type { AgentAdvanceResponse, AgentOp, AgentOpResult } from '@/api/agent';

export type AgentRunStatus = 'idle' | 'thinking' | 'awaiting_confirm' | 'error';

/** A chat turn or a single graph action — rendered as one chronological feed. */
export type AgentTimelineItem =
  | { id: string; kind: 'message'; role: 'user' | 'assistant'; text: string }
  | { id: string; kind: 'activity'; icon: AgentOpIcon; label: string; isError: boolean };

export type UseAgentRunOptions = {
  projectId: string;
  getGraph: () => GraphState;
  applyGraph: (next: GraphState) => void;
};

// A short beat between ops so the user watches the architecture build up.
const STEP_DELAY_MS = 200;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type StepOutcome = {
  state: GraphState;
  results: AgentOpResult[];
  pending?: { op: AgentOp; remaining: AgentOp[] };
};

export function useAgentRun({ projectId, getGraph, applyGraph }: UseAgentRunOptions) {
  const [items, setItems] = useState<AgentTimelineItem[]>([]);
  const [status, setStatus] = useState<AgentRunStatus>('idle');
  const [pendingOp, setPendingOp] = useState<AgentOp | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const pendingResultsRef = useRef<AgentOpResult[]>([]);
  const remainingRef = useRef<AgentOp[]>([]);

  const appendAssistant = useCallback((text: string) => {
    if (!text.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: makeId(), kind: 'message', role: 'assistant', text },
    ]);
  }, []);

  const pushActivity = useCallback((op: AgentOp, isError: boolean) => {
    const { icon, label } = describeOp(op);
    setItems((prev) => [...prev, { id: makeId(), kind: 'activity', icon, label, isError }]);
  }, []);

  const pushSkipped = useCallback((op: AgentOp) => {
    const { label } = describeOp(op);
    setItems((prev) => [
      ...prev,
      { id: makeId(), kind: 'activity', icon: 'info', label: `Skipped — ${label}`, isError: false },
    ]);
  }, []);

  // Apply a turn's ops one at a time (with a beat) so the build is visible.
  // Stops at the first op that needs confirmation.
  const applyOpsStepwise = useCallback(
    async (ops: AgentOp[], startState: GraphState): Promise<StepOutcome> => {
      let state = startState;
      const results: AgentOpResult[] = [];

      for (let index = 0; index < ops.length; index += 1) {
        const op = ops[index];
        if (resolveOpRisk(op.risk, op.name, op.input) === 'confirm') {
          return { state, results, pending: { op, remaining: ops.slice(index + 1) } };
        }
        const outcome = executeOp(op.name, op.input, state);
        state = outcome.state;
        applyGraph(state);
        pushActivity(op, outcome.isError);
        results.push({
          toolCallId: op.toolCallId,
          content: outcome.content,
          isError: outcome.isError,
        });
        if (index < ops.length - 1) await delay(STEP_DELAY_MS);
      }

      return { state, results };
    },
    [applyGraph, pushActivity],
  );

  // Drive the client loop: narrate, apply ops, report results, repeat
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

        const outcome = await applyOpsStepwise(response.ops, getGraph());
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
    [appendAssistant, applyOpsStepwise, getGraph],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === 'thinking') return;

      setItems((prev) => [
        ...prev,
        { id: makeId(), kind: 'message', role: 'user', text: trimmed },
      ]);
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
        if (approved) {
          pushActivity(op, applied.result.isError);
        } else {
          pushSkipped(op);
        }

        const outcome = await applyOpsStepwise(remainingRef.current, applied.state);
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
    [pendingOp, getGraph, applyGraph, pushActivity, pushSkipped, applyOpsStepwise, drive, appendAssistant],
  );

  const reset = useCallback(() => {
    conversationIdRef.current = null;
    runIdRef.current = null;
    pendingResultsRef.current = [];
    remainingRef.current = [];
    setItems([]);
    setPendingOp(null);
    setStatus('idle');
  }, []);

  return { items, status, pendingOp, sendMessage, confirm, reset };
}
