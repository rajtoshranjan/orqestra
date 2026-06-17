# AI Agent — Panel & Run Loop Implementation Plan (Plan C2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the agent usable in the editor — a dockable panel where the user chats with the agent and watches it build the architecture live on the canvas, with risk-graded confirmation for high-impact changes.

**Architecture:** A thin UI layer over the Plan C1 logic. A pure `processOps`/`applyConfirmedOp` module sequences agent ops against the canvas `GraphState` (gated by `resolveOpRisk`); a `useAgentRun` hook orchestrates the client-driven loop (`createAgentConversation` → `sendAgentMessage` → apply ops → `advanceAgentRun` … until completed/awaiting-confirm); the `AgentPanel` renders chat + confirm UI. It mounts inside `CanvasEditor` (which owns the React Flow `nodes`/`edges` state) and applies ops through those setters — so autosave persists them and the user sees nodes appear one by one.

**Tech Stack:** React + TypeScript, Redux Toolkit, ReactFlow, shadcn/ui (`Button`, `Textarea`), lucide-react, vitest. Builds on Plan C1 (`api/agent.ts`, `agent/catalog.ts`, `agent/op-executor.ts`, `agent/risk.ts`).

**Depends on:** Plan C1 complete.

**Testing note:** This repo has **no React testing-library** — existing tests target pure functions (e.g. `derivePermissions`, `executeOp`). So the testable core (`processOps`, `applyConfirmedOp`, the ui-slice reducer) is TDD'd with vitest; the hook, component, and editor wiring are verified by `npx tsc --noEmit` and `npm run build` (which runs `tsc && vite build`). This mirrors the repo's own conventions.

**Scope boundaries:**
- IN: `agentPanelOpen` UI state; pure run-loop sequencing; `useAgentRun` hook; `AgentPanel` component; toolbar toggle button; mount + keyboard shortcut in `CanvasEditor`.
- OUT (later): WebSocket observer streaming of `agent.*` events (the loop is driven by the `advance` HTTP responses; sequential op application already delivers "watch it build"); annotation-tagging surface (Slice B); a structured requirements tracker beyond the static intake hint.

**Conventions:** kebab-case filenames; reuse `createServiceNode`/`withValidatedData` via the C1 op-executor; panel styling mirrors `comments-sidebar.tsx`; run frontend checks on the host (`cd client && ...`).

---

## File Structure

```
client/src/store/ui-slice.ts            # MODIFY: agentPanelOpen + setAgentPanelOpen
client/src/store/ui-slice.test.ts       # NEW
client/src/agent/run-loop.ts            # NEW: processOps, applyConfirmedOp
client/src/agent/run-loop.test.ts       # NEW
client/src/agent/use-agent-run.ts       # NEW: the orchestration hook
client/src/pages/editor/agent-panel.tsx # NEW: the panel UI
client/src/pages/editor/editor-toolbar.tsx  # MODIFY: agent toggle button + props
client/src/pages/editor/editor-canvas.tsx   # MODIFY: mount panel, graphRef, applyGraph, shortcut, toolbar props
```

---

## Task 1: UI state — `agentPanelOpen`

**Files:**
- Modify: `client/src/store/ui-slice.ts`
- Test: `client/src/store/ui-slice.test.ts`

- [ ] **Step 1: Write the failing test**

`client/src/store/ui-slice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

import reducer, { setAgentPanelOpen } from './ui-slice';

describe('ui-slice agent panel', () => {
  it('defaults agentPanelOpen to false', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state.agentPanelOpen).toBe(false);
  });

  it('sets agentPanelOpen', () => {
    const state = reducer(undefined, setAgentPanelOpen(true));
    expect(state.agentPanelOpen).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/store/ui-slice.test.ts`
Expected: FAIL — `setAgentPanelOpen` is not exported / `agentPanelOpen` undefined.

- [ ] **Step 3: Write the implementation**

In `client/src/store/ui-slice.ts`:

Add `agentPanelOpen: boolean;` to the `UiState` type (after `projectSettingsOpen`):

```typescript
  agentPanelOpen: boolean;
```

Add to `initialState` (after `projectSettingsOpen: false,`):

```typescript
  agentPanelOpen: false,
```

Add the reducer (after the `setProjectSettingsOpen` reducer):

```typescript
    setAgentPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.agentPanelOpen = action.payload;
    },
```

Add `setAgentPanelOpen` to the exported actions list:

```typescript
export const {
  setDeployDrawerOpen,
  setProjectSettingsOpen,
  setAgentPanelOpen,
  setContextMenu,
  setTheme,
  toggleTheme,
  setCommentMode,
  toggleReviewMode,
  setActiveAnnotationId,
  setAnnotationFilters,
} = uiSlice.actions;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/store/ui-slice.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/store/ui-slice.ts client/src/store/ui-slice.test.ts
git commit -m "feat(client): add agentPanelOpen UI state"
```

---

## Task 2: Pure run-loop sequencing

**Files:**
- Create: `client/src/agent/run-loop.ts`
- Test: `client/src/agent/run-loop.test.ts`

- [ ] **Step 1: Write the failing test**

`client/src/agent/run-loop.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

import '@/services'; // real registry for executeOp

import type { AgentOp } from '@/api/agent';

import { type GraphState } from './op-executor';
import { applyConfirmedOp, processOps } from './run-loop';

const empty = (): GraphState => ({ nodes: [], edges: [] });

function op(name: string, input: Record<string, unknown>, risk: 'safe' | 'confirm' = 'safe'): AgentOp {
  return { toolCallId: `tc-${name}-${Math.random().toString(16).slice(2)}`, name, input, risk };
}

describe('processOps', () => {
  it('applies safe ops in sequence and returns one result each', () => {
    const ops = [
      op('add_resource', { service_id: 'lambda' }),
      op('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = processOps(ops, empty());

    expect(result.pending).toBeNull();
    expect(result.state.nodes).toHaveLength(2);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => !r.isError)).toBe(true);
  });

  it('stops at a confirm-risk op and returns it plus the remaining ops', () => {
    const ops = [
      op('add_resource', { service_id: 'lambda' }),
      op('remove', { target_id: 'whatever' }, 'confirm'),
      op('add_resource', { service_id: 'dynamodb' }),
    ];

    const result = processOps(ops, empty());

    expect(result.state.nodes).toHaveLength(1); // only the first op applied
    expect(result.results).toHaveLength(1);
    expect(result.pending?.op.name).toBe('remove');
    expect(result.pending?.remaining).toHaveLength(1);
  });
});

describe('applyConfirmedOp', () => {
  it('executes the op when approved', () => {
    const added = processOps([op('add_resource', { service_id: 'lambda' })], empty());
    const node = added.state.nodes[0];

    const { state, result } = applyConfirmedOp(
      op('remove', { target_id: node.id }),
      added.state,
      true,
    );

    expect(state.nodes).toHaveLength(0);
    expect(result.isError).toBe(false);
  });

  it('leaves the graph unchanged when declined', () => {
    const added = processOps([op('add_resource', { service_id: 'lambda' })], empty());

    const { state, result } = applyConfirmedOp(
      op('remove', { target_id: added.state.nodes[0].id }),
      added.state,
      false,
    );

    expect(state.nodes).toHaveLength(1);
    expect(result.content.toLowerCase()).toContain('declined');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/agent/run-loop.test.ts`
Expected: FAIL — cannot find module `./run-loop`.

- [ ] **Step 3: Write the implementation**

`client/src/agent/run-loop.ts`:

```typescript
import type { AgentOp, AgentOpResult } from '@/api/agent';

import { executeOp, type GraphState } from './op-executor';
import { resolveOpRisk } from './risk';

export type ProcessResult = {
  state: GraphState;
  results: AgentOpResult[];
  pending: { op: AgentOp; remaining: AgentOp[] } | null;
};

/**
 * Apply agent ops sequentially against the graph. Stops at the first op whose
 * resolved risk requires confirmation, returning that op plus the ops still to
 * run so the caller can resume after the user decides.
 */
export function processOps(
  ops: AgentOp[],
  state: GraphState,
  resolveRisk: typeof resolveOpRisk = resolveOpRisk,
): ProcessResult {
  let current = state;
  const results: AgentOpResult[] = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (resolveRisk(op.risk, op.name, op.input) === 'confirm') {
      return { state: current, results, pending: { op, remaining: ops.slice(i + 1) } };
    }
    const outcome = executeOp(op.name, op.input, current);
    current = outcome.state;
    results.push({
      toolCallId: op.toolCallId,
      content: outcome.content,
      isError: outcome.isError,
    });
  }

  return { state: current, results, pending: null };
}

/** Apply (or decline) a single op the user was asked to confirm. */
export function applyConfirmedOp(
  op: AgentOp,
  state: GraphState,
  approved: boolean,
): { state: GraphState; result: AgentOpResult } {
  if (!approved) {
    return {
      state,
      result: {
        toolCallId: op.toolCallId,
        content: 'The user declined this change.',
        isError: false,
      },
    };
  }
  const outcome = executeOp(op.name, op.input, state);
  return {
    state: outcome.state,
    result: {
      toolCallId: op.toolCallId,
      content: outcome.content,
      isError: outcome.isError,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/agent/run-loop.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/agent/run-loop.ts client/src/agent/run-loop.test.ts
git commit -m "feat(client): add pure agent run-loop sequencing"
```

---

## Task 3: The run-controller hook

**Files:**
- Create: `client/src/agent/use-agent-run.ts`

(Verified by typecheck — no testing-library in this repo. The testable core is `processOps`/`applyConfirmedOp` from Task 2.)

- [ ] **Step 1: Write the implementation**

`client/src/agent/use-agent-run.ts`:

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/agent/use-agent-run.ts
git commit -m "feat(client): add agent run-controller hook"
```

---

## Task 4: The agent panel component

**Files:**
- Create: `client/src/pages/editor/agent-panel.tsx`

(Verified by typecheck. Styling mirrors `comments-sidebar.tsx`.)

- [ ] **Step 1: Write the implementation**

`client/src/pages/editor/agent-panel.tsx`:

```tsx
import { useState } from 'react';

import { Loader2, Send, ShieldAlert, Sparkles, X } from 'lucide-react';

import { type GraphState } from '@/agent/op-executor';
import { useAgentRun, type AgentChatMessage } from '@/agent/use-agent-run';
import { Button, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/store';
import { setAgentPanelOpen } from '@/store/ui-slice';

const REQUIREMENT_HINTS = [
  'Workload type',
  'Scale & traffic',
  'Data & persistence',
  'Regions',
  'Compliance',
  'Budget',
];

type AgentPanelProps = {
  projectId: string;
  getGraph: () => GraphState;
  applyGraph: (next: GraphState) => void;
};

function MessageBubble({ message }: { message: AgentChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs leading-relaxed',
          isUser
            ? 'bg-primary/15 text-foreground'
            : 'border border-border/60 bg-muted/40 text-foreground',
        )}
      >
        {message.text}
      </div>
    </div>
  );
}

export function AgentPanel({ projectId, getGraph, applyGraph }: AgentPanelProps) {
  const dispatch = useAppDispatch();
  const { messages, status, pendingOp, sendMessage, confirm } = useAgentRun({
    projectId,
    getGraph,
    applyGraph,
  });
  const [input, setInput] = useState('');

  const busy = status === 'thinking' || pendingOp !== null;

  const onSubmit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void sendMessage(text);
  };

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Sparkles size={14} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">AI agent</h2>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="ml-auto size-6 p-0 text-muted-foreground"
          onClick={() => dispatch(setAgentPanelOpen(false))}
          aria-label="Close agent panel"
        >
          <X size={14} />
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Describe the app you want to run. I&apos;ll design a validated AWS
              architecture on the canvas and explain the choices. I&apos;ll ask
              about:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REQUIREMENT_HINTS.map((hint) => (
                <span
                  key={hint}
                  className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {hint}
                </span>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}

        {status === 'thinking' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> Working…
          </div>
        )}

        {pendingOp && (
          <div className="border-warning/30 bg-warning/10 space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
              <ShieldAlert size={13} /> Confirm change
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              The agent wants to run{' '}
              <span className="font-mono text-foreground">{pendingOp.name}</span>
              {typeof pendingOp.input.target_id === 'string'
                ? ` on ${pendingOp.input.target_id}`
                : ''}
              {typeof pendingOp.input.service_id === 'string'
                ? ` (${pendingOp.input.service_id})`
                : ''}
              . This is a higher-impact action.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => void confirm(true)}
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => void confirm(false)}
              >
                Discard
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <p className="text-xs text-destructive">
            The agent hit an error. Try sending your message again.
          </p>
        )}
      </div>

      <div className="border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Describe what you want to build…"
          rows={3}
          className="resize-none text-xs"
          disabled={busy}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onSubmit}
            disabled={busy || !input.trim()}
          >
            <Send size={12} /> Send
          </Button>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/editor/agent-panel.tsx
git commit -m "feat(client): add agent panel component"
```

---

## Task 5: Toolbar toggle button

**Files:**
- Modify: `client/src/pages/editor/editor-toolbar.tsx`

(Verified by typecheck.)

- [ ] **Step 1: Add the icon import**

In `editor-toolbar.tsx`, add `Sparkles` to the `lucide-react` import (keep the list alphabetical-ish, e.g. after `Rocket,`):

```typescript
  Rocket,
  Sparkles,
  Unlock,
```

- [ ] **Step 2: Add the props**

Add to `EditorToolbarProps` (after `onToggleCommentMode?: () => void;`):

```typescript
  agentPanelOpen?: boolean;
  onToggleAgentPanel?: () => void;
```

Add to the destructured params in `EditorToolbarComponent` (after `onToggleCommentMode,`):

```typescript
  agentPanelOpen = false,
  onToggleAgentPanel,
```

- [ ] **Step 3: Add the button**

Immediately **after** the closing `</Tooltip>` of the "Comments Sidebar" button block (the one wrapping the `CommentMarker` button) and before the "Canvas Actions Dropdown" comment, insert:

```tsx
          {/* AI Agent */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleAgentPanel}
                aria-label={agentPanelOpen ? 'Hide AI agent' : 'Show AI agent'}
                aria-pressed={agentPanelOpen}
                className={cn(
                  'h-8 w-8 text-muted-foreground transition-all duration-200',
                  agentPanelOpen &&
                    'bg-accent/20 text-primary hover:bg-accent/30 hover:text-primary',
                )}
                title="Toggle AI agent (⌘J)"
              >
                <Sparkles size={15} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {agentPanelOpen ? 'Hide AI agent' : 'Show AI agent'}
            </TooltipContent>
          </Tooltip>
```

- [ ] **Step 4: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no errors. (`agentPanelOpen`/`onToggleAgentPanel` are optional, so existing callers still compile; they are wired in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/editor/editor-toolbar.tsx
git commit -m "feat(client): add AI agent toggle to editor toolbar"
```

---

## Task 6: Mount the panel in the canvas

**Files:**
- Modify: `client/src/pages/editor/editor-canvas.tsx`

(Verified by typecheck + build.)

- [ ] **Step 1: Add imports**

In `editor-canvas.tsx`, add the agent imports. Next to the other `@/hooks` usage, import the shortcut hook and agent pieces:

- Add to the existing `import { setDeployDrawerOpen, setProjectSettingsOpen, setContextMenu, setCommentMode } from '@/store/ui-slice';` block → add `setAgentPanelOpen`:

```typescript
import {
  setDeployDrawerOpen,
  setProjectSettingsOpen,
  setContextMenu,
  setCommentMode,
  setAgentPanelOpen,
} from '@/store/ui-slice';
```

- Add these imports near the other editor-local imports (e.g. after the `import { CommentsSidebar } from './comments/comments-sidebar';` line):

```typescript
import { AgentPanel } from './agent-panel';
```

- Add the shortcut hook and GraphState type imports (with the existing `@/hooks` and `@/agent` imports respectively):

```typescript
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { type GraphState } from '@/agent/op-executor';
```

- [ ] **Step 2: Read `agentPanelOpen` from the store**

Change the UI selector from:

```typescript
  const { deployDrawerOpen, contextMenu, theme, commentMode } = useAppSelector(
    (state) => state.ui,
  );
```

to:

```typescript
  const { deployDrawerOpen, contextMenu, theme, commentMode, agentPanelOpen } =
    useAppSelector((state) => state.ui);
```

- [ ] **Step 3: Add the graph ref, apply callback, and shortcut**

Immediately after this line:

```typescript
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialProject.edges);
```

insert:

```typescript

  // The agent reads/writes the live canvas graph through these. graphRef always
  // points at the latest nodes/edges so sequential ops seed from current state.
  const graphRef = React.useRef<GraphState>({ nodes, edges });
  graphRef.current = { nodes, edges };
  const applyAgentGraph = React.useCallback(
    (next: GraphState) => {
      setNodes(next.nodes);
      setEdges(next.edges);
    },
    [setNodes, setEdges],
  );

  useKeyboardShortcuts(
    [
      {
        key: 'j',
        meta: true,
        description: 'Toggle AI agent',
        category: 'general',
        handler: () => dispatch(setAgentPanelOpen(!agentPanelOpen)),
      },
    ],
    [agentPanelOpen, dispatch],
  );
```

- [ ] **Step 4: Pass the toolbar props**

On the `<EditorToolbar ... />` element, add these two props (e.g. next to the existing `commentMode={commentMode}` / `onToggleCommentMode={...}` props):

```tsx
        agentPanelOpen={agentPanelOpen}
        onToggleAgentPanel={() => dispatch(setAgentPanelOpen(!agentPanelOpen))}
```

- [ ] **Step 5: Mount the panel**

Change this line:

```tsx
        {commentMode && <CommentsSidebar comments={comments} />}
```

to:

```tsx
        {commentMode && <CommentsSidebar comments={comments} />}
        {agentPanelOpen && (
          <AgentPanel
            projectId={currentProjectId}
            getGraph={() => graphRef.current}
            applyGraph={applyAgentGraph}
          />
        )}
```

- [ ] **Step 6: Typecheck + build**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

Run: `cd client && npm run build`
Expected: build succeeds (`tsc && vite build`).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/editor/editor-canvas.tsx
git commit -m "feat(client): mount AI agent panel in the editor"
```

---

## Task 7: Full verification

**Files:** none.

- [ ] **Step 1: Run the full frontend suite**

Run: `cd client && npx vitest run`
Expected: all tests PASS (existing + ui-slice + run-loop).

- [ ] **Step 2: Typecheck + build**

Run: `cd client && npx tsc --noEmit && npm run build`
Expected: clean typecheck and a successful build.

- [ ] **Step 3: Commit (only if fixes were needed)**

```bash
git add -A
git commit -m "chore(client): agent panel verification green"
```

(Skip if nothing is staged.)

---

## Done criteria for Plan C2

- [ ] `cd client && npx vitest run` passes.
- [ ] `cd client && npx tsc --noEmit && npm run build` clean.
- [ ] In the editor, the toolbar Sparkles button (and ⌘/Ctrl+J) toggles the agent panel; sending a message creates a conversation, streams the agent's reply, and applies its graph ops to the canvas (which autosaves); high-impact ops surface an Apply/Discard confirm card before they apply.

## Manual smoke test (requires the running app + a configured `ANTHROPIC_API_KEY` on the server)

1. `docker compose up`, open a project.
2. Press ⌘/Ctrl+J (or click the Sparkles button) to open the agent panel.
3. Send: "A web API with a Postgres database and a background job queue."
4. Watch nodes appear and wire up on the canvas; confirm the saved indicator ticks over.
5. Ask it to "delete the queue" and confirm the Apply/Discard card appears.

## Feature status after C2

With Plans A + B + C1 + C2 the agent is end-to-end usable: chat → server LLM loop → ops streamed back → applied to the canvas under the same validation/cost rules → autosaved. Remaining (Slice B): annotation-tagging edits, agent-authored annotations, and richer fine-grained cost/security risk. WebSocket observer streaming of `agent.*` events (for collaborators watching a build) is also a future enhancement.
