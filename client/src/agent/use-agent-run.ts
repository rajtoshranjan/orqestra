import { useCallback, useEffect, useRef, useState } from 'react';

import {
  advanceAgentRun,
  createAgentConversation,
  fetchLatestConversation,
  sendAgentMessage,
  type AgentConversationMessage,
  AgentAdvanceResponse,
  AgentOp,
  AgentOpResult,
} from '@/api/agent';
import { makeId } from '@/utils/diagram';

import { buildAgentCatalog } from './catalog';
import { describeAgentError } from './errors';
import { executeOp, toServerGraph, type GraphState } from './op-executor';
import { describeOp, type AgentOpIcon } from './op-label';
import { resolveOpRisk } from './risk';
import { applyConfirmedOp, STRUCTURAL_OPS } from './run-loop';

export type AgentRunStatus = 'idle' | 'thinking' | 'awaiting_confirm' | 'error';

/** A chat turn or a single graph action — rendered as one chronological feed. */
export type AgentTimelineItem =
  | { id: string; kind: 'message'; role: 'user' | 'assistant'; text: string }
  | {
      id: string;
      kind: 'activity';
      icon: AgentOpIcon;
      label: string;
      isError: boolean;
    };

export type UseAgentRunOptions = {
  projectId: string;
  getGraph: () => GraphState;
  applyGraph: (next: GraphState) => void;
  /** When true, rehydrate the latest persisted conversation on first open. */
  enabled?: boolean;
  /** Re-tidy the canvas after a run makes structural changes. */
  layoutGraph?: (graph: GraphState) => GraphState;
};

/** Rebuild the visible transcript from persisted conversation messages. */
export function messagesToTimeline(
  messages: AgentConversationMessage[],
): AgentTimelineItem[] {
  const items: AgentTimelineItem[] = [];
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'text' && block.text.trim()) {
        items.push({
          id: makeId(),
          kind: 'message',
          role: message.role === 'user' ? 'user' : 'assistant',
          text: block.text,
        });
      } else if (block.type === 'tool_call') {
        const { icon, label } = describeOp({
          name: block.name,
          input: block.input,
        });
        items.push({
          id: makeId(),
          kind: 'activity',
          icon,
          label,
          isError: false,
        });
      }
      // tool_result blocks are internal plumbing — not shown in the transcript.
    }
  }
  return items;
}

// A short beat between ops so the user watches the architecture build up.
const STEP_DELAY_MS = 200;
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type StepOutcome = {
  state: GraphState;
  results: AgentOpResult[];
  pending?: { op: AgentOp; remaining: AgentOp[] };
};

export function useAgentRun({
  projectId,
  getGraph,
  applyGraph,
  enabled = true,
  layoutGraph,
}: UseAgentRunOptions) {
  const [items, setItems] = useState<AgentTimelineItem[]>([]);
  const [status, setStatus] = useState<AgentRunStatus>('idle');
  const [pendingOp, setPendingOp] = useState<AgentOp | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const lastMessageRef = useRef<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const pendingResultsRef = useRef<AgentOpResult[]>([]);
  const remainingRef = useRef<AgentOp[]>([]);
  const hydratedRef = useRef(false);
  // Track whether the run changed topology, and the last applied state, so we
  // can re-tidy the layout once the run settles.
  const structuralRef = useRef(false);
  const latestStateRef = useRef<GraphState | null>(null);

  // Rehydrate the latest persisted conversation the first time the panel opens
  // for this project, so closing/reopening (or reloading) keeps the thread.
  useEffect(() => {
    if (!enabled || hydratedRef.current || conversationIdRef.current) return;
    hydratedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const convo = await fetchLatestConversation(projectId);
        if (cancelled || !convo || conversationIdRef.current) return;
        conversationIdRef.current = convo.id;
        setItems(messagesToTimeline(convo.messages));
      } catch {
        // Non-fatal: a failed rehydrate just starts a fresh thread.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, projectId]);

  const appendAssistant = useCallback((text: string) => {
    if (!text.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: makeId(), kind: 'message', role: 'assistant', text },
    ]);
  }, []);

  const pushActivity = useCallback((op: AgentOp, isError: boolean) => {
    const { icon, label } = describeOp(op);
    setItems((prev) => [
      ...prev,
      { id: makeId(), kind: 'activity', icon, label, isError },
    ]);
  }, []);

  const pushSkipped = useCallback((op: AgentOp) => {
    const { label } = describeOp(op);
    setItems((prev) => [
      ...prev,
      {
        id: makeId(),
        kind: 'activity',
        icon: 'info',
        label: `Skipped — ${label}`,
        isError: false,
      },
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
          return {
            state,
            results,
            pending: { op, remaining: ops.slice(index + 1) },
          };
        }
        const outcome = executeOp(op.name, op.input, state);
        state = outcome.state;
        latestStateRef.current = state;
        if (outcome.mutated && STRUCTURAL_OPS.has(op.name)) {
          structuralRef.current = true;
        }
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

  // Once a run settles, re-tidy the canvas if it changed topology so the agent's
  // additions don't sit in the naive build-time grid.
  const finalizeLayout = useCallback(() => {
    if (!layoutGraph || !structuralRef.current || !latestStateRef.current) return;
    const laid = layoutGraph(latestStateRef.current);
    latestStateRef.current = laid;
    structuralRef.current = false;
    applyGraph(laid);
  }, [applyGraph, layoutGraph]);

  // Drive the client loop: narrate, apply ops, report results, repeat
  // until the run completes or an op needs confirmation.
  const drive = useCallback(
    async (initial: AgentAdvanceResponse) => {
      let response = initial;
      for (;;) {
        runIdRef.current = response.runId;
        appendAssistant(response.assistantText);

        if (response.status === 'failed') {
          setStatus('error');
          setErrorText(response.error || 'The agent run failed unexpectedly.');
          return;
        }

        if (
          response.status !== 'awaiting_client' ||
          response.ops.length === 0
        ) {
          finalizeLayout();
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

        response = await advanceAgentRun(
          response.runId,
          outcome.results,
          toServerGraph(outcome.state),
        );
      }
    },
    [appendAssistant, applyOpsStepwise, getGraph, finalizeLayout],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === 'thinking') return;

      setErrorText(null);
      lastMessageRef.current = trimmed;
      structuralRef.current = false;
      latestStateRef.current = null;

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
        const response = await sendAgentMessage(
          conversationIdRef.current,
          trimmed,
          toServerGraph(getGraph()),
        );
        await drive(response);
      } catch (error) {
        setStatus('error');
        setErrorText(describeAgentError(error));
      }
    },
    [projectId, status, drive, appendAssistant, getGraph],
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
        latestStateRef.current = applied.state;
        if (approved) {
          if (STRUCTURAL_OPS.has(op.name)) structuralRef.current = true;
          pushActivity(op, applied.result.isError);
        } else {
          pushSkipped(op);
        }

        const outcome = await applyOpsStepwise(
          remainingRef.current,
          applied.state,
        );
        const results = [
          ...pendingResultsRef.current,
          applied.result,
          ...outcome.results,
        ];

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
        const next = await advanceAgentRun(
          runId,
          results,
          toServerGraph(outcome.state),
        );
        await drive(next);
      } catch (error) {
        setStatus('error');
        setErrorText(describeAgentError(error));
      }
    },
    [
      pendingOp,
      getGraph,
      applyGraph,
      pushActivity,
      pushSkipped,
      applyOpsStepwise,
      drive,
      appendAssistant,
    ],
  );

  const reset = useCallback(() => {
    conversationIdRef.current = null;
    runIdRef.current = null;
    pendingResultsRef.current = [];
    remainingRef.current = [];
    setItems([]);
    setPendingOp(null);
    setStatus('idle');
    setErrorText(null);
    lastMessageRef.current = null;
  }, []);

  const retry = useCallback(async () => {
    if (!lastMessageRef.current || status === 'thinking') return;
    const trimmed = lastMessageRef.current;

    setErrorText(null);
    setStatus('thinking');
    structuralRef.current = false;
    latestStateRef.current = null;

    setItems((prev) => [
      ...prev,
      {
        id: makeId(),
        kind: 'message',
        role: 'user',
        text: `Retry: ${trimmed}`,
      },
    ]);

    try {
      if (!conversationIdRef.current) {
        const conversation = await createAgentConversation({
          projectId,
          catalog: buildAgentCatalog(),
        });
        conversationIdRef.current = conversation.id;
      }
      const response = await sendAgentMessage(
        conversationIdRef.current,
        trimmed,
        toServerGraph(getGraph()),
      );
      await drive(response);
    } catch (error) {
      setStatus('error');
      setErrorText(describeAgentError(error));
    }
  }, [projectId, status, drive, getGraph]);

  return {
    items,
    status,
    pendingOp,
    errorText,
    sendMessage,
    confirm,
    retry,
    reset,
  };
}
