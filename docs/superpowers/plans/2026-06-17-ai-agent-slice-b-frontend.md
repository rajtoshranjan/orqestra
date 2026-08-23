# AI Agent — Slice B Frontend (Tag the Agent in Annotations)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user tag the agent in an annotation (`@orqestra`) on a node/edge/canvas; the agent makes the change on the canvas and replies in that thread.

**Architecture:** Client-driven and reuses everything from C1/C2. When a comment (new annotation or reply) mentions `@orqestra`, the editor runs an anchored agent loop: it seeds a message from the comment + its target, runs `send`/`advance`, applies ops to the canvas (auto-applying safe ops, auto-declining high-impact ones with a note since there's no in-thread confirm UI), then posts the agent's summary via the Slice-B backend reply endpoint. The reply appears in-thread via the existing `annotation.updated` realtime invalidation.

**Tech Stack:** React + TypeScript, Redux, ReactFlow, vitest. Builds on Plan C1/C2 (`op-executor`, `run-loop`, `api/agent`, the editor `graphRef`/`applyAgentGraph`) and the Slice B backend (`POST /agent/annotations/{id}/reply/`).

**Depends on:** Plans C1, C2, and Slice B backend.

**Testing note:** No React testing-library — pure logic is vitest-tested; effectful runner/hook/UI wiring is verified by `cd client && npx tsc --noEmit` + `npm run build`.

**Scope boundaries:**
- IN: `@orqestra` plain-text trigger detection; anchored message seeding; auto-decline-risky sequencing; `replyToAnnotation` API; the anchored runner; wiring into `use-comments` + `CanvasEditor`; agent identity in the comment thread.
- OUT: rich `@`-mention autocomplete chips for the agent (v1 uses a plain `@orqestra` trigger; the contentEditable chip engine is unchanged); agent-initiated/proactive annotations.

**Key facts (verified):**
- `useComments` exposes `submitDraft(body)` (creates a new annotation, returns it) and `reply(body)` (adds to the active annotation); it has `nodes` for label lookup and `activeAnnotation`.
- `CanvasEditor` already has `graphRef` (latest `{nodes, edges}`) and `applyAgentGraph` (from C2), plus `toast` imported.
- `ClientComment` has `authorType: AnnotationAuthorType` (`'user' | 'system' | 'agent'`) and `origin`. The thread renders each comment in `ThreadComment` (`comment-thread-popover.tsx`) using `comment.authorName || 'Unknown'`.
- The Slice-B backend reply endpoint emits `annotation.updated`, which the WebSocket provider turns into an `['annotations']` invalidation — so an agent reply refreshes the thread with no extra client work.
- C1/C2 exports: `processOps`/`applyConfirmedOp`/`GraphState` (`@/agent/run-loop`, `@/agent/op-executor`), `executeOp`, `resolveOpRisk` (`@/agent/risk`), `createAgentConversation`/`sendAgentMessage`/`advanceAgentRun` + `AgentOp`/`AgentOpResult` (`@/api/agent`), `buildAgentCatalog` (`@/agent/catalog`).

---

## File Structure

```
client/src/agent/run-loop.ts            # ADD processOpsAutoDecline()
client/src/agent/run-loop.test.ts       # ADD tests
client/src/agent/annotation-trigger.ts  # NEW: bodyMentionsAgent, buildAnnotationAgentMessage
client/src/agent/annotation-trigger.test.ts  # NEW
client/src/api/agent.ts                 # ADD replyToAnnotation()
client/src/api/agent.test.ts            # ADD test
client/src/agent/run-annotation.ts      # NEW: runAnnotationAgent() (effectful)
client/src/pages/editor/comments/use-comments.ts   # MODIFY: onAgentRequest trigger
client/src/pages/editor/editor-canvas.tsx          # MODIFY: wire onAgentRequest -> runAnnotationAgent
client/src/pages/editor/comments/comment-thread-popover.tsx  # MODIFY: agent identity
```

---

## Task 1: Auto-decline sequencing (pure)

**Files:**
- Modify: `client/src/agent/run-loop.ts`
- Test: `client/src/agent/run-loop.test.ts`

- [ ] **Step 1: Write the failing test**

In `client/src/agent/run-loop.test.ts`, update the existing `./run-loop` import to add `processOpsAutoDecline`:

```typescript
import { applyConfirmedOp, processOps, processOpsAutoDecline } from './run-loop';
```

Then append the new describe block:

```typescript
describe('processOpsAutoDecline', () => {
  it('applies safe ops and declines risky ones without stopping', () => {
    const ops = [
      op('add_resource', { service_id: 'lambda' }),
      op('remove', { target_id: 'x' }, 'confirm'),
      op('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = processOpsAutoDecline(ops, empty());

    expect(result.state.nodes).toHaveLength(2); // both add_resource applied
    expect(result.declined).toHaveLength(1);
    expect(result.declined[0].name).toBe('remove');
    expect(result.results).toHaveLength(3); // a result per op (incl. the decline)
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/agent/run-loop.test.ts`
Expected: FAIL — `processOpsAutoDecline` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `client/src/agent/run-loop.ts`:

```typescript
export type AutoProcessResult = {
  state: GraphState;
  results: AgentOpResult[];
  declined: AgentOp[];
};

/**
 * Like processOps but never stops: safe ops apply, confirm-risk ops are
 * auto-declined (graph unchanged for them) and recorded. Used by the
 * annotation-tagging flow, which has no in-thread confirm UI.
 */
export function processOpsAutoDecline(
  ops: AgentOp[],
  state: GraphState,
  resolveRisk: typeof resolveOpRisk = resolveOpRisk,
): AutoProcessResult {
  let current = state;
  const results: AgentOpResult[] = [];
  const declined: AgentOp[] = [];

  for (const op of ops) {
    if (resolveRisk(op.risk, op.name, op.input) === 'confirm') {
      const { result } = applyConfirmedOp(op, current, false);
      results.push(result);
      declined.push(op);
      continue;
    }
    const outcome = executeOp(op.name, op.input, current);
    current = outcome.state;
    results.push({
      toolCallId: op.toolCallId,
      content: outcome.content,
      isError: outcome.isError,
    });
  }

  return { state: current, results, declined };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/agent/run-loop.test.ts`
Expected: PASS (all run-loop tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add client/src/agent/run-loop.ts client/src/agent/run-loop.test.ts
git commit -m "feat(client): add auto-decline op sequencing for annotation runs"
```

---

## Task 2: Trigger detection + message seeding (pure)

**Files:**
- Create: `client/src/agent/annotation-trigger.ts`
- Test: `client/src/agent/annotation-trigger.test.ts`

- [ ] **Step 1: Write the failing test**

`client/src/agent/annotation-trigger.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

import { bodyMentionsAgent, buildAnnotationAgentMessage } from './annotation-trigger';

describe('bodyMentionsAgent', () => {
  it('detects @orqestra at the start or after whitespace', () => {
    expect(bodyMentionsAgent('@orqestra add a cache')).toBe(true);
    expect(bodyMentionsAgent('hey @Orqestra please help')).toBe(true);
  });

  it('ignores plain text and email-like strings', () => {
    expect(bodyMentionsAgent('just a normal comment')).toBe(false);
    expect(bodyMentionsAgent('email me@orqestra.com')).toBe(false);
  });
});

describe('buildAnnotationAgentMessage', () => {
  it('includes the node label and the user message', () => {
    const message = buildAnnotationAgentMessage({
      targetType: 'node',
      targetId: 'n1',
      label: 'API Lambda',
      body: '@orqestra give this more memory',
    });

    expect(message).toContain('API Lambda');
    expect(message).toContain('n1');
    expect(message).toContain('@orqestra give this more memory');
  });

  it('handles canvas targets', () => {
    const message = buildAnnotationAgentMessage({
      targetType: 'canvas',
      body: '@orqestra add a staging environment',
    });

    expect(message.toLowerCase()).toContain('canvas');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/agent/annotation-trigger.test.ts`
Expected: FAIL — cannot find module `./annotation-trigger`.

- [ ] **Step 3: Write the implementation**

`client/src/agent/annotation-trigger.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/agent/annotation-trigger.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/agent/annotation-trigger.ts client/src/agent/annotation-trigger.test.ts
git commit -m "feat(client): add agent annotation trigger + message seeding"
```

---

## Task 3: `replyToAnnotation` API

**Files:**
- Modify: `client/src/api/agent.ts`
- Test: `client/src/api/agent.test.ts`

- [ ] **Step 1: Write the failing test**

In `client/src/api/agent.test.ts`, add `replyToAnnotation` to the existing top-of-file `./agent` import:

```typescript
import {
  advanceAgentRun,
  createAgentConversation,
  replyToAnnotation,
  sendAgentMessage,
} from './agent';
```

Then append a test inside the existing `describe('agent api', ...)` block:

```typescript
  it('posts an agent reply to an annotation', async () => {
    post.mockResolvedValue({ data: { data: {} } });

    await replyToAnnotation('a1', 'Added a cache.');

    expect(post).toHaveBeenCalledWith('/agent/annotations/a1/reply/', {
      body: 'Added a cache.',
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/api/agent.test.ts`
Expected: FAIL — `replyToAnnotation` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `client/src/api/agent.ts`:

```typescript
export async function replyToAnnotation(
  annotationId: string,
  body: string,
): Promise<void> {
  await api.post(`/agent/annotations/${annotationId}/reply/`, { body });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/api/agent.test.ts`
Expected: PASS (all agent api tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/api/agent.ts client/src/api/agent.test.ts
git commit -m "feat(client): add replyToAnnotation API call"
```

---

## Task 4: The anchored runner

**Files:**
- Create: `client/src/agent/run-annotation.ts`

(Effectful — verified by typecheck; its pure dependency `processOpsAutoDecline` is tested in Task 1.)

- [ ] **Step 1: Write the implementation**

`client/src/agent/run-annotation.ts`:

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/agent/run-annotation.ts
git commit -m "feat(client): add anchored annotation agent runner"
```

---

## Task 5: Trigger from comments + wire in the canvas

**Files:**
- Modify: `client/src/pages/editor/comments/use-comments.ts`
- Modify: `client/src/pages/editor/editor-canvas.tsx`

(Verified by typecheck + build.)

- [ ] **Step 1: Add the trigger to `useComments`**

In `use-comments.ts`, add the import:

```typescript
import { bodyMentionsAgent } from '@/agent/annotation-trigger';
```

Add the callback type to `UseCommentsParams`:

```typescript
type UseCommentsParams = {
  projectId: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  reactFlowInstance: ReactFlowInstance<ServiceNodeData> | null;
  onAgentRequest?: (req: {
    annotationId: string;
    targetType: AnnotationTargetType;
    targetId?: string;
    label?: string;
    body: string;
  }) => void;
};
```

Destructure it in the hook signature:

```typescript
export const useComments = ({
  projectId,
  nodes,
  edges,
  reactFlowInstance,
  onAgentRequest,
}: UseCommentsParams) => {
```

Replace `submitDraft` with a version that fires the trigger (capture the draft fields before clearing):

```typescript
  const submitDraft = useCallback(
    async (body: string) => {
      if (!draft) return;
      const { targetType, targetId } = draft;
      const annotation = await createAnnotationMutation.mutateAsync({
        projectId,
        targetType,
        targetId,
        position: draft.position,
        body,
      });
      setDraft(null);
      dispatch(setActiveAnnotationId(annotation.id));

      if (onAgentRequest && bodyMentionsAgent(body)) {
        const label =
          targetType === 'node' && targetId
            ? nodes.find((n) => n.id === targetId)?.data.label
            : undefined;
        onAgentRequest({ annotationId: annotation.id, targetType, targetId, label, body });
      }
    },
    [draft, createAnnotationMutation, projectId, dispatch, onAgentRequest, nodes],
  );
```

Replace `reply` with a version that fires the trigger:

```typescript
  const reply = useCallback(
    (body: string) => {
      if (!activeAnnotationId) return;
      addCommentMutation.mutate({ annotationId: activeAnnotationId, body });

      if (onAgentRequest && bodyMentionsAgent(body) && activeAnnotation) {
        const label =
          activeAnnotation.targetType === 'node' && activeAnnotation.targetId
            ? nodes.find((n) => n.id === activeAnnotation.targetId)?.data.label
            : undefined;
        onAgentRequest({
          annotationId: activeAnnotationId,
          targetType: activeAnnotation.targetType,
          targetId: activeAnnotation.targetId,
          label,
          body,
        });
      }
    },
    [activeAnnotationId, addCommentMutation, onAgentRequest, activeAnnotation, nodes],
  );
```

- [ ] **Step 2: Wire the canvas**

In `editor-canvas.tsx`, add imports:

```typescript
import { buildAnnotationAgentMessage } from '@/agent/annotation-trigger';
import { runAnnotationAgent } from '@/agent/run-annotation';
```

Find the existing `useComments({ ... })` call and add the `onAgentRequest` handler:

```typescript
    onAgentRequest: (req) => {
      toast({
        title: 'Orqestra is working…',
        description: 'Updating your architecture from your comment.',
      });
      void runAnnotationAgent({
        projectId: currentProjectId,
        annotationId: req.annotationId,
        message: buildAnnotationAgentMessage(req),
        getGraph: () => graphRef.current,
        applyGraph: applyAgentGraph,
      }).catch(() => {
        toast({
          title: 'Agent error',
          description: 'Could not complete the request from your comment.',
          variant: 'destructive',
        });
      });
    },
```

- [ ] **Step 3: Typecheck + build**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

Run: `cd client && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/editor/comments/use-comments.ts client/src/pages/editor/editor-canvas.tsx
git commit -m "feat(client): trigger the agent from @orqestra annotations"
```

---

## Task 6: Render the agent's identity in the thread

**Files:**
- Modify: `client/src/pages/editor/comments/comment-thread-popover.tsx`

(Verified by typecheck.)

- [ ] **Step 1: Add imports**

Add `Sparkles` to the existing `lucide-react` import, and add the `cn` import:

```typescript
import { Check, MoreHorizontal, Pencil, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
```

```typescript
import { cn } from '@/lib/utils';
```

- [ ] **Step 2: Render agent identity in `ThreadComment`**

In `ThreadComment`, just before the `return (`, add:

```typescript
  const isAgent = comment.authorType === 'agent';
  const displayName = isAgent ? 'Orqestra' : comment.authorName || 'Unknown';
```

Replace the avatar + name block:

```tsx
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
          {getInitials(comment.authorName || '?')}
        </span>
        <span className="truncate text-xs font-medium text-foreground">
          {comment.authorName || 'Unknown'}
        </span>
```

with:

```tsx
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-primary',
            isAgent ? 'bg-primary/20' : 'bg-primary/15',
          )}
        >
          {isAgent ? <Sparkles size={12} /> : getInitials(comment.authorName || '?')}
        </span>
        <span className="truncate text-xs font-medium text-foreground">
          {displayName}
        </span>
```

- [ ] **Step 3: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/editor/comments/comment-thread-popover.tsx
git commit -m "feat(client): show Orqestra identity on agent comments"
```

---

## Task 7: Full verification

- [ ] **Step 1: Frontend suite**

Run: `cd client && npx vitest run`
Expected: all tests PASS (existing + run-loop + annotation-trigger + agent api).

- [ ] **Step 2: Typecheck + build**

Run: `cd client && npx tsc --noEmit && npm run build`
Expected: clean typecheck and a successful build.

- [ ] **Step 3: Commit (only if fixes were needed)**

```bash
git add -A && git commit -m "chore(client): slice B frontend verification green"
```

(Skip if nothing is staged.)

---

## Done criteria

- [ ] `cd client && npx vitest run` passes; `npx tsc --noEmit && npm run build` clean.
- [ ] Tagging `@orqestra` in a node/edge/canvas comment runs the agent against the live canvas, applies safe changes (auto-declining high-impact ones with a note), and posts an agent-authored reply that appears in the thread with the Orqestra identity.

## Manual smoke test (needs `ANTHROPIC_API_KEY` on the server)

1. `docker compose up`, open a project, press `C`, click a node, and post: "@orqestra give this Lambda more memory".
2. Watch the node's config update on the canvas; the thread gets an "Orqestra" reply summarizing the change.

## Feature complete

With A + B + C1 + C2 + Slice B (backend + frontend), the agent is fully usable: chat-panel generation/edits AND annotation-tagged in-place edits, under the same validation/cost/risk rules, design-time only. Future enhancements: agent-initiated/proactive annotations, `@`-mention autocomplete chips for the agent, WebSocket observer streaming for collaborators, and a server-authored executor (headless runs).
