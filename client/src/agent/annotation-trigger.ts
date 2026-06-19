/** Matches an @orqestra tag at the start of the body or after whitespace. */
const AGENT_MENTION_PATTERN = /(^|\s)@orqestra\b/i;

export function bodyMentionsAgent(body: string): boolean {
  return AGENT_MENTION_PATTERN.test(body);
}

type AgentThreadComment = { body: string; authorType?: string };
type AgentThreadState = { status: string; comments: AgentThreadComment[] };

/**
 * Once the agent has been tagged in a thread (or has already replied) it stays
 * engaged and follows every subsequent comment — until the thread is resolved.
 */
export function threadEngagesAgent(thread: AgentThreadState): boolean {
  if (thread.status === 'resolved') return false;
  return thread.comments.some(
    (comment) =>
      comment.authorType === 'agent' || bodyMentionsAgent(comment.body),
  );
}

/**
 * Whether a newly submitted comment should hand off to the agent: either it
 * tags `@orqestra` explicitly, or it lands in an open thread the agent is
 * already engaged in (so the user needn't re-tag on every reply).
 */
export function shouldTriggerAgent(
  body: string,
  thread: AgentThreadState,
): boolean {
  return bodyMentionsAgent(body) || threadEngagesAgent(thread);
}

export type AnnotationContext = {
  targetType: string;
  targetId?: string;
  label?: string;
  body: string;
};

/** Seed the agent message for an annotation-anchored request. */
export function buildAnnotationAgentMessage(ctx: AnnotationContext): string {
  let where: string;
  if (ctx.targetType === 'node') {
    where = ctx.label
      ? `on the "${ctx.label}" resource (node id ${ctx.targetId})`
      : `on node ${ctx.targetId}`;
  } else if (ctx.targetType === 'edge') {
    where = `on the connection ${ctx.targetId}`;
  } else {
    where = 'on the canvas';
  }

  return (
    `The user tagged you in an annotation ${where}. ` +
    `Apply the change they asked for, then briefly summarize what you did.\n\n` +
    `Their message: ${ctx.body}`
  );
}
