import {
  advanceAgentRun,
  createAgentConversation,
  replyToAnnotation,
  sendAgentMessage,
} from '@/api/agent';

import { buildAgentCatalog } from './catalog';
import { type GraphState } from './op-executor';
import { processOpsAutoDecline } from './run-loop';

export type RunAnnotationAgentOptions = {
  projectId: string;
  annotationId: string;
  message: string;
  getGraph: () => GraphState;
  applyGraph: (next: GraphState) => void;
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
}: RunAnnotationAgentOptions): Promise<void> {
  let declinedCount = 0;
  try {
    const conversation = await createAgentConversation({
      projectId,
      catalog: buildAgentCatalog(),
    });
    let response = await sendAgentMessage(conversation.id, message);

    for (;;) {
      if (response.status !== 'awaiting_client' || response.ops.length === 0) {
        break;
      }
      const outcome = processOpsAutoDecline(response.ops, getGraph());
      applyGraph(outcome.state);
      declinedCount += outcome.declined.length;
      response = await advanceAgentRun(response.runId, outcome.results);
    }

    const note =
      declinedCount > 0
        ? `\n\nI held off on ${declinedCount} higher-impact change(s) — open the agent panel (⌘J) to review them.`
        : '';
    await replyToAnnotation(annotationId, (response.assistantText || 'Done.') + note);
  } catch (error) {
    await replyToAnnotation(
      annotationId,
      `I couldn't complete that request: ${String(error)}`,
    ).catch(() => undefined);
    throw error;
  }
}
