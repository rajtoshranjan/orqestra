import {
  advanceAgentRun,
  createAgentConversation,
  fetchConversationForAnnotation,
  replyToAnnotation,
  sendAgentMessage,
} from '@/api/agent';

import { buildAgentCatalog } from './catalog';
import { describeAgentError } from './errors';
import { toServerGraph, type GraphState } from './op-executor';
import { processOpsAutoDecline } from './run-loop';

export type RunAnnotationAgentOptions = {
  projectId: string;
  annotationId: string;
  message: string;
  getGraph: () => GraphState;
  applyGraph: (next: GraphState) => void;
  /** Re-tidy the canvas after structural changes (added/removed/wired nodes). */
  layoutGraph?: (graph: GraphState) => GraphState;
};

/**
 * Run one annotation-anchored agent request: drive the loop, apply safe ops
 * to the canvas (auto-declining high-impact ones), then post the summary as an
 * agent reply in the thread.
 */
export async function runAnnotationAgent({
  projectId,
  annotationId,
  message,
  getGraph,
  applyGraph,
  layoutGraph,
}: RunAnnotationAgentOptions): Promise<void> {
  let declinedCount = 0;
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
    let response = await sendAgentMessage(
      activeConversationId,
      message,
      toServerGraph(latestState),
    );

    for (;;) {
      // A failed run carries the provider error and no usable output — surface it
      // in the thread instead of silently posting the "Done." fallback below.
      if (response.status === 'failed') {
        throw new Error(response.error || 'The agent run failed.');
      }
      if (response.status !== 'awaiting_client' || response.ops.length === 0) {
        break;
      }
      const outcome = processOpsAutoDecline(response.ops, latestState);
      latestState = outcome.state;
      structural = structural || outcome.structural;
      applyGraph(latestState);
      declinedCount += outcome.declined.length;
      response = await advanceAgentRun(
        response.runId,
        outcome.results,
        toServerGraph(latestState),
      );
    }

    if (structural && layoutGraph) {
      applyGraph(layoutGraph(latestState));
    }

    const note =
      declinedCount > 0
        ? `\n\nI held off on ${declinedCount} higher-impact change(s) — open the agent panel (⌘J) to review them.`
        : '';
    await replyToAnnotation(
      annotationId,
      (response.assistantText || 'Done.') + note,
    );
  } catch (error) {
    await replyToAnnotation(
      annotationId,
      `I couldn't complete that request: ${describeAgentError(error)}`,
    ).catch(() => undefined);
    throw error;
  }
}
