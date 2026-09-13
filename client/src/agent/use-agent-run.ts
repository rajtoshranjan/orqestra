import { useCallback, useEffect, useRef, useState } from 'react';

import {
  advanceAgentRun,
  cancelAgentRun,
  createAgentConversation,
  fetchLatestConversation,
  sendAgentMessage,
  type AgentConversationMessage,
  AgentAdvanceResponse,
  AgentOperation,
  AgentOperationResult,
} from '@/api/agent';
import { makeId } from '@/utils/diagram';

import { buildAgentCatalog } from './catalog';
import { describeAgentError } from './errors';
import { toServerGraph, type GraphState } from './operation-executor';
import { describeOperation, type AgentOperationIcon } from './operation-label';
import { applyConfirmedOperation, processOperations } from './run-loop';

export type AgentRunStatus =
  | 'idle'
  | 'thinking'
  | 'awaiting_confirm'
  | 'cancelling'
  | 'error';

/** A chat turn or a single graph action — rendered as one chronological feed. */
export type AgentTimelineItem =
  | { id: string; kind: 'message'; role: 'user' | 'assistant'; text: string }
  | {
      id: string;
      kind: 'activity';
      icon: AgentOperationIcon;
      label: string;
      isError: boolean;
    }
  | { id: string; kind: 'notice'; text: string };

export type UseAgentRunOptions = {
  projectId: string;
  getGraph: () => GraphState;
  applyGraph: (next: GraphState) => void;
  /** When true, rehydrate the latest persisted conversation on first open. */
  enabled?: boolean;
  /** Re-tidy the canvas after a run makes structural changes. */
  layoutGraph?: (graph: GraphState) => GraphState;
  /** Read-only viewers can watch a run but never start one. */
  readOnly?: boolean;
};

/** Rebuild the visible transcript from persisted conversation messages. */
export function messagesToTimeline(
  messages: AgentConversationMessage[],
): AgentTimelineItem[] {
  // Operation failures are recorded as tool_result blocks on the following message, so
  // collect them first — otherwise a reloaded transcript renders every operation as a
  // success and misrepresents what actually happened.
  const failed = new Set<string>();
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'tool_result' && block.is_error) {
        failed.add(block.tool_call_id);
      }
    }
  }

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
        const { icon, past } = describeOperation({
          name: block.name,
          input: block.input,
        });
        items.push({
          id: makeId(),
          kind: 'activity',
          icon,
          label: past,
          isError: failed.has(block.id),
        });
      }
      // tool_result blocks are internal plumbing — not shown in the transcript.
    }
  }
  return items;
}

// A short beat between operations so the user watches the architecture build up.
const STEP_DELAY_MS = 200;
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useAgentRun({
  projectId,
  getGraph,
  applyGraph,
  enabled = true,
  layoutGraph,
  readOnly = false,
}: UseAgentRunOptions) {
  const [items, setItems] = useState<AgentTimelineItem[]>([]);
  const [status, setStatus] = useState<AgentRunStatus>('idle');
  const [pendingOp, setPendingOp] = useState<AgentOperation | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const lastMessageRef = useRef<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const pendingResultsRef = useRef<AgentOperationResult[]>([]);
  const remainingRef = useRef<AgentOperation[]>([]);
  const hydratedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Track whether the run changed topology, and the last applied state, so we
  // can re-tidy the layout once the run settles.
  const structuralRef = useRef(false);
  const latestStateRef = useRef<GraphState | null>(null);

  const pushNotice = useCallback((text: string) => {
    setItems((prev) => [...prev, { id: makeId(), kind: 'notice', text }]);
  }, []);

  /**
   * Drop everything belonging to the previous run. Without this a stale
   * `pendingOp` or half-collected results can be spliced into a *different*
   * run's advance, writing tool results against calls that run never made.
   */
  const clearRunState = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    runIdRef.current = null;
    pendingResultsRef.current = [];
    remainingRef.current = [];
    structuralRef.current = false;
    latestStateRef.current = null;
    setPendingOp(null);
  }, []);

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
        if (convo.activeRun) {
          // A run the previous session left mid-flight. Its operations are already on
          // the canvas and autosaved; re-applying them would duplicate, so
          // retire it and say so rather than silently resuming.
          await cancelAgentRun(convo.activeRun.id).catch(() => undefined);
          pushNotice(
            'The previous run was interrupted before it finished. Send a message to pick up where it left off.',
          );
        }
      } catch {
        // Non-fatal: a failed rehydrate just starts a fresh thread.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, pushNotice]);

  const appendAssistant = useCallback((text: string) => {
    if (!text.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: makeId(), kind: 'message', role: 'assistant', text },
    ]);
  }, []);

  const pushActivity = useCallback(
    (operation: AgentOperation, isError: boolean) => {
      const { icon, past } = describeOperation(
        operation,
        latestStateRef.current ?? undefined,
      );
      setItems((prev) => [
        ...prev,
        { id: makeId(), kind: 'activity', icon, label: past, isError },
      ]);
    },
    [],
  );

  const pushSkipped = useCallback((operation: AgentOperation) => {
    const { pending } = describeOperation(
      operation,
      latestStateRef.current ?? undefined,
    );
    setItems((prev) => [
      ...prev,
      {
        id: makeId(),
        kind: 'activity',
        icon: 'info',
        label: `Skipped — ${pending.toLowerCase()}`,
        isError: false,
      },
    ]);
  }, []);

  // Apply a turn's operations one at a time (with a beat) so the build is visible.
  // Stops at the first operation that needs confirmation, or when the user cancels.
  const applyOperationsStepwise = useCallback(
    (operations: AgentOperation[], startState: GraphState) =>
      processOperations(operations, startState, {
        confirmPolicy: 'pause',
        signal: abortRef.current?.signal,
        beat: () => delay(STEP_DELAY_MS),
        onApplied: (operation, outcome) => {
          latestStateRef.current = outcome.state;
          applyGraph(outcome.state);
          pushActivity(operation, outcome.isError);
        },
      }),
    [applyGraph, pushActivity],
  );

  // Once a run settles, re-tidy the canvas if it changed topology so the agent's
  // additions don't sit in the naive build-time grid.
  const finalizeLayout = useCallback(() => {
    if (!layoutGraph || !structuralRef.current || !latestStateRef.current)
      return;
    const laid = layoutGraph(latestStateRef.current);
    latestStateRef.current = laid;
    structuralRef.current = false;
    applyGraph(laid);
  }, [applyGraph, layoutGraph]);

  // Drive the client loop: narrate, apply operations, report results, repeat
  // until the run completes or an operation needs confirmation.
  const drive = useCallback(
    async (initial: AgentAdvanceResponse) => {
      let response = initial;
      // Thread the applied state forward rather than re-reading getGraph()
      // between turns: React state may not have flushed across the awaits.
      let state = latestStateRef.current ?? getGraph();

      for (;;) {
        runIdRef.current = response.runId;
        appendAssistant(response.assistantText);

        if (response.status === 'failed') {
          setStatus('error');
          setErrorText(response.error || 'The agent run failed unexpectedly.');
          return;
        }
        if (response.status === 'cancelled') {
          finalizeLayout();
          pushNotice('Stopped. The changes so far are on the canvas.');
          setStatus('idle');
          return;
        }
        if (
          response.status !== 'awaiting_client' ||
          response.operations.length === 0
        ) {
          finalizeLayout();
          setStatus('idle');
          return;
        }

        const outcome = await applyOperationsStepwise(
          response.operations,
          state,
        );
        state = outcome.state;
        latestStateRef.current = state;
        if (outcome.structural) structuralRef.current = true;

        if (outcome.aborted) {
          finalizeLayout();
          pushNotice('Stopped. The changes so far are on the canvas.');
          setStatus('idle');
          return;
        }
        if (outcome.pending) {
          pendingResultsRef.current = outcome.results;
          remainingRef.current = outcome.pending.remaining;
          setPendingOp(outcome.pending.operation);
          setStatus('awaiting_confirm');
          return;
        }

        response = await advanceAgentRun(
          response.runId,
          outcome.results,
          toServerGraph(state),
          abortRef.current?.signal,
        );
      }
    },
    [
      appendAssistant,
      applyOperationsStepwise,
      getGraph,
      finalizeLayout,
      pushNotice,
    ],
  );

  /** Start a turn from a user message, reusing or creating the conversation. */
  const startRun = useCallback(
    async (text: string, echo: boolean) => {
      clearRunState();
      setErrorText(null);
      lastMessageRef.current = text;
      latestStateRef.current = getGraph();
      abortRef.current = new AbortController();

      if (echo) {
        setItems((prev) => [
          ...prev,
          { id: makeId(), kind: 'message', role: 'user', text },
        ]);
      }
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
          text,
          toServerGraph(getGraph()),
          abortRef.current.signal,
        );
        await drive(response);
      } catch (error) {
        if (abortRef.current?.signal.aborted) {
          setStatus('idle');
          return;
        }
        setStatus('error');
        setErrorText(describeAgentError(error));
      }
    },
    [clearRunState, projectId, drive, getGraph],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || readOnly) return;
      // A message sent mid-run would start a second run on the same
      // conversation and interleave its history.
      if (status !== 'idle' && status !== 'error') return;
      await startRun(trimmed, true);
    },
    [readOnly, status, startRun],
  );

  const retry = useCallback(async () => {
    const last = lastMessageRef.current;
    if (!last || readOnly) return;
    if (status !== 'idle' && status !== 'error') return;
    await startRun(last, false);
  }, [readOnly, status, startRun]);

  /** Stop a run in flight. Operations already applied stay on the canvas. */
  const cancel = useCallback(async () => {
    const runId = runIdRef.current;
    abortRef.current?.abort();
    setStatus('cancelling');
    setPendingOp(null);
    try {
      if (runId) await cancelAgentRun(runId);
    } catch {
      // The local abort already stopped the loop; a failed cancel just leaves
      // the server run to be swept as stale.
    }
    finalizeLayout();
    pushNotice('Stopped. The changes so far are on the canvas.');
    clearRunState();
    setStatus('idle');
  }, [clearRunState, finalizeLayout, pushNotice]);

  const confirm = useCallback(
    async (approved: boolean) => {
      const operation = pendingOp;
      if (!operation) return;
      setPendingOp(null);
      setStatus('thinking');
      try {
        const base = latestStateRef.current ?? getGraph();
        const applied = applyConfirmedOperation(operation, base, approved);
        applyGraph(applied.state);
        latestStateRef.current = applied.state;
        if (approved) {
          if (applied.structural) structuralRef.current = true;
          pushActivity(operation, applied.result.isError);
        } else {
          pushSkipped(operation);
        }

        const outcome = await applyOperationsStepwise(
          remainingRef.current,
          applied.state,
        );
        latestStateRef.current = outcome.state;
        if (outcome.structural) structuralRef.current = true;
        const results = [
          ...pendingResultsRef.current,
          applied.result,
          ...outcome.results,
        ];

        if (outcome.pending) {
          pendingResultsRef.current = results;
          remainingRef.current = outcome.pending.remaining;
          setPendingOp(outcome.pending.operation);
          setStatus('awaiting_confirm');
          return;
        }

        const runId = runIdRef.current;
        if (!runId || outcome.aborted) {
          setStatus('idle');
          return;
        }
        pendingResultsRef.current = [];
        remainingRef.current = [];
        const next = await advanceAgentRun(
          runId,
          results,
          toServerGraph(outcome.state),
          abortRef.current?.signal,
        );
        await drive(next);
      } catch (error) {
        if (abortRef.current?.signal.aborted) {
          setStatus('idle');
          return;
        }
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
      applyOperationsStepwise,
      drive,
    ],
  );

  const reset = useCallback(() => {
    clearRunState();
    conversationIdRef.current = null;
    lastMessageRef.current = null;
    setItems([]);
    setStatus('idle');
    setErrorText(null);
  }, [clearRunState]);

  // Abandon an in-flight run if the editor unmounts mid-build.
  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    items,
    status,
    pendingOp,
    errorText,
    sendMessage,
    confirm,
    cancel,
    retry,
    reset,
    /** The graph the confirmation card describes its operation against. */
    pendingGraph: latestStateRef.current,
  };
}
