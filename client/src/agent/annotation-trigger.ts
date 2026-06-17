/** Matches an @orqestra tag at the start of the body or after whitespace. */
const AGENT_MENTION_PATTERN = /(^|\s)@orqestra\b/i;

export function bodyMentionsAgent(body: string): boolean {
  return AGENT_MENTION_PATTERN.test(body);
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
