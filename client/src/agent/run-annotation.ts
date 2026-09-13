import {
  advanceAgentRun,
  createAgentConversation,
  fetchActiveRunForAnnotation,
  fetchConversationForAnnotation,
  replyToAnnotation,
  sendAgentMessage,
  type AgentAdvanceResponse,
} from '@/api/agent';

import { buildAgentCatalog } from './catalog';
import { toServerGraph, type GraphState } from './operation-executor';
import { applyConfirmedOperation, processOperations } from './run-loop';

export type RunAnnotationAgentOptions = {
  projectId: string;
  annotationId: string;
  message: string;
  getGraph: () => GraphState;
  applyGraph: (next: GraphState) => void;
  /** Re-tidy the canvas after structural changes (added/removed/wired nodes). */
  layoutGraph?: (graph: GraphState) => GraphState;
};

export type RunAnnotationResult = {
  /** A run was already working this thread, so this comment was not acted on. */
  skipped: boolean;
  /** The run paused on a high-impact operation and asked for approval in the thread. */
  awaitingConfirmation: boolean;
};

/**
 * Whether a thread reply approves a pending change.
 *
 * Deliberately a small deterministic matcher rather than another model call:
 * the decision gates a destructive operation, so it has to be predictable, and
 * anything it does not recognise is treated as "no" — the safe direction.
 */
const AFFIRMATIVE =
  /^\s*(yes|yep|yeah|ok|okay|sure|confirm(ed)?|approve[d]?|apply|do it|go ahead|proceed)\b/i;

export function isAffirmative(text: string): boolean {
  return AFFIRMATIVE.test(text);
}

/**
 * Run one annotation-anchored agent request.
 *
 * Confirmation happens in the thread rather than in a panel that cannot show
 * this conversation: a high-impact operation pauses the run and posts a question, and
 * the next comment resolves it. That keeps the whole exchange in one place and
 * means anchored threads can do the full action space, deletions included.
 */
export async function runAnnotationAgent({
  projectId,
  annotationId,
  message,
  getGraph,
  applyGraph,
  layoutGraph,
}: RunAnnotationAgentOptions): Promise<RunAnnotationResult> {
  let runId: string | null = null;
  try {
    // Reuse the conversation already anchored to this thread (persisted on the
    // server) so the agent keeps its memory across reloads; create one only the
    // first time the thread engages the agent.
    let activeConversationId =
      await fetchConversationForAnnotation(annotationId);
    if (!activeConversationId) {
      const conversation = await createAgentConversation({
        projectId,
        catalog: buildAgentCatalog(),
        annotationId,
      });
      activeConversationId = conversation.id;
    }

    // Thread the applied state across turns rather than re-reading getGraph()
    // (React state may not have flushed between awaits).
    let latestState = getGraph();
    let structural = false;

    const paused = await fetchActiveRunForAnnotation(annotationId);
    let response: AgentAdvanceResponse;

    if (paused && paused.operations.length > 0) {
      // This comment is the answer to a confirmation we asked for.
      const approved = isAffirmative(message);
      const [operation, ...rest] = paused.operations;
      const applied = applyConfirmedOperation(operation, latestState, approved);
      latestState = applied.state;
      structural = structural || applied.structural;
      applyGraph(latestState);

      const outcome = await processOperations(rest, latestState, {
        confirmPolicy: 'pause',
      });
      latestState = outcome.state;
      structural = structural || outcome.structural;
      applyGraph(latestState);

      runId = paused.id;
      response = await advanceAgentRun(
        paused.id,
        [applied.result, ...outcome.results],
        toServerGraph(latestState),
      );
    } else if (paused) {
      // A run is mid-flight on this thread with nothing to report; a second one
      // would interleave its history.
      return { skipped: true, awaitingConfirmation: false };
    } else {
      response = await sendAgentMessage(
        activeConversationId,
        message,
        toServerGraph(latestState),
      );
    }

    for (;;) {
      runId = response.runId;
      if (response.status === 'failed') {
        // The catch below posts the reply, derived server-side from the run's
        // own error — posting here too would double up.
        throw new Error(response.error || 'The agent run failed.');
      }
      if (
        response.status !== 'awaiting_client' ||
        response.operations.length === 0
      ) {
        break;
      }

      const outcome = await processOperations(
        response.operations,
        latestState,
        {
          confirmPolicy: 'pause',
        },
      );
      latestState = outcome.state;
      structural = structural || outcome.structural;
      applyGraph(latestState);

      if (outcome.pending) {
        // Leave the run paused and let it ask its own question in the thread —
        // the server builds that text from the run's outstanding operations. The next
        // comment resumes it via the `paused` branch above.
        if (structural && layoutGraph) applyGraph(layoutGraph(latestState));
        await replyToAnnotation(annotationId, response.runId);
        return { skipped: false, awaitingConfirmation: true };
      }

      response = await advanceAgentRun(
        response.runId,
        outcome.results,
        toServerGraph(latestState),
      );
    }

    if (structural && layoutGraph) {
      applyGraph(layoutGraph(latestState));
    }

    await replyToAnnotation(annotationId, response.runId);
    return { skipped: false, awaitingConfirmation: false };
  } catch (error) {
    // Only a real run can speak as the agent: without one there is nothing to
    // attribute a reply to, so the caller surfaces the failure instead.
    if (runId) {
      await replyToAnnotation(annotationId, runId).catch(() => undefined);
    }
    throw error;
  }
}
