# AI Agent — Frontend Core Implementation Plan (Plan C1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend "hands" of the agent — the pure logic that projects the service registry into a catalog, calls the agent REST API, executes agent graph-ops against the canvas state, and grades op risk — all unit-tested with vitest and with zero UI.

**Architecture:** The agent loop is client-driven (Plan B). This plan delivers the deterministic pieces the UI (Plan C2) will orchestrate: `buildAgentCatalog()` projects `registry` (including `aiHints`) into the catalog sent to the server; `api/agent.ts` wraps the three endpoints; `executeOp()` takes the current `{nodes, edges}` plus one agent op and returns the next `{nodes, edges}` and a result string (reusing the canonical `createServiceNode`/`withValidatedData` factories so agent-made nodes are identical to user-made ones); `resolveOpRisk()` escalates the server's coarse risk using each service's `costProfile`.

**Tech Stack:** React + TypeScript, Redux Toolkit (consumed in C2), ReactFlow node/edge model, vitest. Builds on Plan B's API.

**Depends on:** Plan B endpoints live (`/agent/conversations/`, `.../send/`, `/agent/runs/{id}/advance/`).

**Scope boundaries:**
- IN: `api/agent.ts` (types + 3 calls + mappers); `agent/catalog.ts`; `agent/op-executor.ts` (10 ops); `agent/risk.ts`. All vitest-tested.
- OUT (Plan C2): the agent panel UI, the run-controller hook, WebSocket event wiring (`addEventListener` exposed on the context), confirm UI, editor mounting, keyboard shortcut.

**Key facts (verified in the codebase):**
- Node factory: `createServiceNode(serviceId, position, index)` → `{ id: uuid, type: `${serviceId}Node`, position, data: { serviceId, label, config, validationErrors } }` (`src/utils/diagram.ts`).
- `withValidatedData(node, nodes, edges)` re-validates config + structural rules and refreshes `label`.
- `adjustParentSizes(nodes)` resizes containers; `getDescendants(parentId, nodes)` lists nested node ids; `makeId()` mints ids.
- The op `input` arrives **opaque** with snake_case top-level keys (from the backend tool schema: `service_id`, `parent_id`, `source_id`, `target_id`, `relationship_kind`, `node_id`, `config_patch`, `config`, `label`, `target_id`, `category`). Service `config` values use the frontend's own camelCase keys. The executor reads snake_case top-level keys and passes `config`/`config_patch` through untouched.
- Server advance payload is snake_case: `{run_id, status, assistant_text, ops:[{tool_call_id, name, input, risk}]}`.
- Tests import `@/services` to populate the real `registry`.

**Conventions:** filenames kebab-case; constants SCREAMING_SNAKE_CASE; types added (no `any` leaks past boundaries); reuse before creating; run frontend tests on the host: `cd client && npx vitest run <path>`.

---

## File Structure

```
client/src/api/agent.ts            # types (AgentOp, AgentOpResult, AgentAdvanceResponse, AgentCatalogEntry, AgentRiskLevel) + 3 API calls
client/src/api/agent.test.ts
client/src/agent/catalog.ts        # buildAgentCatalog()
client/src/agent/catalog.test.ts
client/src/agent/risk.ts           # resolveOpRisk()
client/src/agent/risk.test.ts
client/src/agent/op-executor.ts    # executeOp() + GraphState/OpOutcome
client/src/agent/op-executor.test.ts
```

---

## Task 1: Agent API module

**Files:**
- Create: `client/src/api/agent.ts`
- Test: `client/src/api/agent.test.ts`

- [ ] **Step 1: Write the failing test**

`client/src/api/agent.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({ api: { post: vi.fn() } }));

import { api } from './client';
import {
  advanceAgentRun,
  createAgentConversation,
  sendAgentMessage,
} from './agent';

const post = api.post as unknown as ReturnType<typeof vi.fn>;

describe('agent api', () => {
  beforeEach(() => post.mockReset());

  it('creates a conversation with project + catalog', async () => {
    post.mockResolvedValue({
      data: { data: { id: 'c1', project: 'p1', status: 'active' } },
    });

    const result = await createAgentConversation({
      projectId: 'p1',
      catalog: [{ id: 'lambda', name: 'AWS Lambda', category: 'compute' }],
    });

    expect(post).toHaveBeenCalledWith('/agent/conversations/', {
      project: 'p1',
      catalog: [{ id: 'lambda', name: 'AWS Lambda', category: 'compute' }],
    });
    expect(result).toEqual({ id: 'c1', projectId: 'p1', status: 'active' });
  });

  it('maps the advance payload from send', async () => {
    post.mockResolvedValue({
      data: {
        data: {
          run_id: 'r1',
          status: 'awaiting_client',
          assistant_text: 'Adding a Lambda.',
          ops: [
            { tool_call_id: 'tc_1', name: 'add_resource', input: { service_id: 'lambda' }, risk: 'safe' },
          ],
        },
      },
    });

    const result = await sendAgentMessage('c1', 'build api');

    expect(post).toHaveBeenCalledWith('/agent/conversations/c1/send/', { message: 'build api' });
    expect(result.runId).toBe('r1');
    expect(result.assistantText).toBe('Adding a Lambda.');
    expect(result.ops[0]).toEqual({
      toolCallId: 'tc_1',
      name: 'add_resource',
      input: { service_id: 'lambda' },
      risk: 'safe',
    });
  });

  it('sends op results in snake_case to advance', async () => {
    post.mockResolvedValue({
      data: { data: { run_id: 'r1', status: 'completed', assistant_text: 'Done.', ops: [] } },
    });

    const result = await advanceAgentRun('r1', [
      { toolCallId: 'tc_1', content: 'node added', isError: false },
    ]);

    expect(post).toHaveBeenCalledWith('/agent/runs/r1/advance/', {
      op_results: [{ tool_call_id: 'tc_1', content: 'node added', is_error: false }],
    });
    expect(result.status).toBe('completed');
    expect(result.ops).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/api/agent.test.ts`
Expected: FAIL — cannot find module `./agent`.

- [ ] **Step 3: Write minimal implementation**

`client/src/api/agent.ts`:

```typescript
import { api } from './client';

import type { ServerResponse } from './types';

export type AgentRiskLevel = 'safe' | 'confirm';

export type AgentCatalogEntry = {
  id: string;
  name: string;
  category: string;
  capabilities?: { provides?: string[]; requires?: string[]; optional?: string[] };
  allowedParents?: string[];
  allowedRelationships?: string[];
  isContainer?: boolean;
  summary?: string;
  role?: string;
  useCases?: string[];
};

export type AgentOp = {
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
  risk: AgentRiskLevel;
};

export type AgentOpResult = {
  toolCallId: string;
  content: string;
  isError: boolean;
};

export type AgentAdvanceResponse = {
  runId: string;
  status: string;
  assistantText: string;
  ops: AgentOp[];
};

type RawOp = {
  tool_call_id: string;
  name: string;
  input: Record<string, unknown>;
  risk: AgentRiskLevel;
};

type RawAdvance = {
  run_id: string;
  status: string;
  assistant_text: string;
  ops: RawOp[];
};

type RawConversation = { id: string; project: string; status: string };

function mapAdvance(data: RawAdvance): AgentAdvanceResponse {
  return {
    runId: data.run_id,
    status: data.status,
    assistantText: data.assistant_text,
    ops: (data.ops ?? []).map((op) => ({
      toolCallId: op.tool_call_id,
      name: op.name,
      input: op.input,
      risk: op.risk,
    })),
  };
}

export async function createAgentConversation(params: {
  projectId: string;
  catalog: AgentCatalogEntry[];
}): Promise<{ id: string; projectId: string; status: string }> {
  const response = await api.post<ServerResponse<RawConversation>>(
    '/agent/conversations/',
    { project: params.projectId, catalog: params.catalog },
  );
  const data = response.data.data;
  return { id: data.id, projectId: data.project, status: data.status };
}

export async function sendAgentMessage(
  conversationId: string,
  message: string,
): Promise<AgentAdvanceResponse> {
  const response = await api.post<ServerResponse<RawAdvance>>(
    `/agent/conversations/${conversationId}/send/`,
    { message },
  );
  return mapAdvance(response.data.data);
}

export async function advanceAgentRun(
  runId: string,
  opResults: AgentOpResult[],
): Promise<AgentAdvanceResponse> {
  const response = await api.post<ServerResponse<RawAdvance>>(
    `/agent/runs/${runId}/advance/`,
    {
      op_results: opResults.map((result) => ({
        tool_call_id: result.toolCallId,
        content: result.content,
        is_error: result.isError,
      })),
    },
  );
  return mapAdvance(response.data.data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/api/agent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/api/agent.ts client/src/api/agent.test.ts
git commit -m "feat(client): add agent API module"
```

---

## Task 2: Catalog projection

**Files:**
- Create: `client/src/agent/catalog.ts`
- Test: `client/src/agent/catalog.test.ts`

- [ ] **Step 1: Write the failing test**

`client/src/agent/catalog.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

import '@/services'; // populate the real registry

import { buildAgentCatalog } from './catalog';

describe('buildAgentCatalog', () => {
  it('projects registered services into catalog entries', () => {
    const catalog = buildAgentCatalog();
    const lambda = catalog.find((entry) => entry.id === 'lambda');

    expect(lambda).toBeDefined();
    expect(lambda?.category).toBe('compute');
    expect(typeof lambda?.summary).toBe('string');
    expect(lambda?.summary?.length).toBeGreaterThan(0);
  });

  it('includes capabilities and relationship metadata', () => {
    const catalog = buildAgentCatalog();
    const lambda = catalog.find((entry) => entry.id === 'lambda');

    expect(lambda?.capabilities?.requires).toContain('execution-role');
    expect(Array.isArray(lambda?.allowedRelationships)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/agent/catalog.test.ts`
Expected: FAIL — cannot find module `./catalog`.

- [ ] **Step 3: Write minimal implementation**

`client/src/agent/catalog.ts`:

```typescript
import { registry } from '@/services';

import type { AgentCatalogEntry } from '@/api/agent';

/**
 * Project the frontend service registry into the catalog the agent reasons
 * over. The rich service metadata lives only on the frontend, so the client
 * supplies this snapshot to the server when starting a conversation.
 */
export function buildAgentCatalog(): AgentCatalogEntry[] {
  return registry.getAll().map((service) => ({
    id: service.id,
    name: service.name,
    category: service.category,
    capabilities: service.capabilities,
    allowedParents: service.allowedParents,
    allowedRelationships: service.allowedRelationships,
    isContainer: service.isContainer ?? false,
    summary: service.aiHints?.summary,
    role: service.aiHints?.role,
    useCases: service.aiHints?.useCases,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/agent/catalog.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/agent/catalog.ts client/src/agent/catalog.test.ts
git commit -m "feat(client): add agent catalog projection"
```

---

## Task 3: Client-side risk classifier

**Files:**
- Create: `client/src/agent/risk.ts`
- Test: `client/src/agent/risk.test.ts`

- [ ] **Step 1: Write the failing test**

`client/src/agent/risk.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services', () => ({
  registry: {
    find: (serviceId: string) => {
      const tiers: Record<string, string> = { redshift: 'high', lambda: 'variable' };
      return tiers[serviceId]
        ? { costProfile: { tier: tiers[serviceId] } }
        : null;
    },
  },
}));

import { resolveOpRisk } from './risk';

describe('resolveOpRisk', () => {
  it('keeps server-flagged confirm risk', () => {
    expect(resolveOpRisk('confirm', 'add_resource', { service_id: 'lambda' })).toBe('confirm');
  });

  it('escalates add_resource for high-cost services', () => {
    expect(resolveOpRisk('safe', 'add_resource', { service_id: 'redshift' })).toBe('confirm');
  });

  it('leaves low-cost additions safe', () => {
    expect(resolveOpRisk('safe', 'add_resource', { service_id: 'lambda' })).toBe('safe');
  });

  it('leaves read-only ops safe', () => {
    expect(resolveOpRisk('safe', 'query_graph', {})).toBe('safe');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/agent/risk.test.ts`
Expected: FAIL — cannot find module `./risk`.

- [ ] **Step 3: Write minimal implementation**

`client/src/agent/risk.ts`:

```typescript
import { registry } from '@/services';

import type { AgentRiskLevel } from '@/api/agent';

/**
 * Merge the server's coarse op-type risk with fine-grained, client-only signal.
 * The cost/security profiles live on the frontend service definitions, so the
 * final risk grade is resolved here, at apply time.
 */
export function resolveOpRisk(
  serverRisk: AgentRiskLevel,
  opName: string,
  input: Record<string, unknown>,
): AgentRiskLevel {
  if (serverRisk === 'confirm') return 'confirm';

  if (opName === 'add_resource') {
    const service = registry.find(String(input.service_id ?? ''));
    if (service?.costProfile?.tier === 'high') return 'confirm';
  }

  return 'safe';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/agent/risk.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/agent/risk.ts client/src/agent/risk.test.ts
git commit -m "feat(client): add client-side op risk classifier"
```

---

## Task 4: Op-executor — mutating ops + dispatcher

**Files:**
- Create: `client/src/agent/op-executor.ts`
- Test: `client/src/agent/op-executor.test.ts`

- [ ] **Step 1: Write the failing test**

`client/src/agent/op-executor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

import '@/services'; // real registry for createServiceNode

import { executeOp, type GraphState } from './op-executor';

const empty = (): GraphState => ({ nodes: [], edges: [] });

describe('executeOp — mutating ops', () => {
  it('add_resource creates a node from the registry', () => {
    const outcome = executeOp('add_resource', { service_id: 'lambda' }, empty());

    expect(outcome.isError).toBe(false);
    expect(outcome.mutated).toBe(true);
    expect(outcome.state.nodes).toHaveLength(1);
    const node = outcome.state.nodes[0];
    expect(node.data.serviceId).toBe('lambda');
    expect(node.type).toBe('lambdaNode');
    expect(outcome.content).toContain('Added lambda');
  });

  it('add_resource merges supplied config', () => {
    const outcome = executeOp(
      'add_resource',
      { service_id: 'lambda', config: { functionName: 'my-api' }, label: 'My API' },
      empty(),
    );

    const node = outcome.state.nodes[0];
    expect(node.data.config.functionName).toBe('my-api');
    expect(node.data.label).toBe('My API');
  });

  it('add_resource errors on an unknown service', () => {
    const outcome = executeOp('add_resource', { service_id: 'nope' }, empty());

    expect(outcome.isError).toBe(true);
    expect(outcome.mutated).toBe(false);
    expect(outcome.state.nodes).toHaveLength(0);
  });

  it('connect adds a typed edge between existing nodes', () => {
    const added = executeOp('add_resource', { service_id: 'lambda' }, empty());
    const second = executeOp('add_resource', { service_id: 'dynamodb' }, added.state);
    const [a, b] = second.state.nodes;

    const outcome = executeOp(
      'connect',
      { source_id: a.id, target_id: b.id, relationship_kind: 'reads-from' },
      second.state,
    );

    expect(outcome.isError).toBe(false);
    expect(outcome.state.edges).toHaveLength(1);
    expect(outcome.state.edges[0].source).toBe(a.id);
    expect(outcome.state.edges[0].data?.relationshipKind).toBe('reads-from');
  });

  it('connect errors when an endpoint is missing', () => {
    const outcome = executeOp(
      'connect',
      { source_id: 'x', target_id: 'y', relationship_kind: 'invokes' },
      empty(),
    );

    expect(outcome.isError).toBe(true);
    expect(outcome.state.edges).toHaveLength(0);
  });

  it('configure patches a node config', () => {
    const added = executeOp('add_resource', { service_id: 'lambda' }, empty());
    const node = added.state.nodes[0];

    const outcome = executeOp(
      'configure',
      { node_id: node.id, config_patch: { memorySize: 512 } },
      added.state,
    );

    expect(outcome.isError).toBe(false);
    expect(outcome.state.nodes[0].data.config.memorySize).toBe(512);
  });

  it('remove deletes a node and its connected edges', () => {
    const added = executeOp('add_resource', { service_id: 'lambda' }, empty());
    const second = executeOp('add_resource', { service_id: 'dynamodb' }, added.state);
    const [a, b] = second.state.nodes;
    const connected = executeOp(
      'connect',
      { source_id: a.id, target_id: b.id, relationship_kind: 'reads-from' },
      second.state,
    );

    const outcome = executeOp('remove', { target_id: a.id }, connected.state);

    expect(outcome.isError).toBe(false);
    expect(outcome.state.nodes.map((n) => n.id)).toEqual([b.id]);
    expect(outcome.state.edges).toHaveLength(0);
  });

  it('returns an error for an unknown op', () => {
    const outcome = executeOp('frobnicate', {}, empty());

    expect(outcome.isError).toBe(true);
    expect(outcome.mutated).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/agent/op-executor.test.ts`
Expected: FAIL — cannot find module `./op-executor`.

- [ ] **Step 3: Write minimal implementation**

`client/src/agent/op-executor.ts`:

```typescript
import { registry } from '@/services';
import type { DiagramEdge, DiagramEdgeData, DiagramNode } from '@/types';
import {
  adjustParentSizes,
  createServiceNode,
  getDescendants,
  makeId,
  withValidatedData,
} from '@/utils/diagram';

export type GraphState = { nodes: DiagramNode[]; edges: DiagramEdge[] };

export type OpOutcome = {
  state: GraphState;
  content: string;
  isError: boolean;
  mutated: boolean;
};

const COLUMNS = 4;
const GAP_X = 280;
const GAP_Y = 160;

function errorOutcome(state: GraphState, content: string): OpOutcome {
  return { state, content, isError: true, mutated: false };
}

function readOutcome(state: GraphState, content: string): OpOutcome {
  return { state, content, isError: false, mutated: false };
}

function nextTopLevelPosition(state: GraphState): { x: number; y: number } {
  const count = state.nodes.filter((node) => !node.parentNode).length;
  return {
    x: 40 + (count % COLUMNS) * GAP_X,
    y: 40 + Math.floor(count / COLUMNS) * GAP_Y,
  };
}

function summarizeErrors(node: DiagramNode): string {
  const errors = Object.values(node.data.validationErrors).filter(Boolean);
  return errors.length ? ` Validation: ${errors.join('; ')}` : ' Validation: ok.';
}

function addResource(input: Record<string, any>, state: GraphState): OpOutcome {
  const serviceId = String(input.service_id ?? '');
  if (!registry.find(serviceId)) {
    return errorOutcome(state, `Unknown service_id "${serviceId}".`);
  }

  const parentId = input.parent_id != null ? String(input.parent_id) : undefined;
  if (parentId && !state.nodes.some((node) => node.id === parentId)) {
    return errorOutcome(state, `Parent node "${parentId}" not found.`);
  }

  const position = parentId ? { x: 24, y: 56 } : nextTopLevelPosition(state);
  let node = createServiceNode(serviceId, position, state.nodes.length + 1);

  if (input.config && typeof input.config === 'object') {
    node = {
      ...node,
      data: { ...node.data, config: { ...node.data.config, ...(input.config as object) } },
    };
  }
  if (input.label) {
    node = { ...node, data: { ...node.data, label: String(input.label) } };
  }
  if (parentId) {
    node = { ...node, parentNode: parentId, extent: 'parent' };
  }

  let nodes = [...state.nodes, node];
  const validated = withValidatedData(node, nodes, state.edges);
  nodes = nodes.map((current) => (current.id === validated.id ? validated : current));
  nodes = adjustParentSizes(nodes);

  return {
    state: { nodes, edges: state.edges },
    content: `Added ${serviceId} node "${validated.data.label}" (id ${validated.id}).${summarizeErrors(validated)}`,
    isError: false,
    mutated: true,
  };
}

function connect(input: Record<string, any>, state: GraphState): OpOutcome {
  const source = String(input.source_id ?? '');
  const target = String(input.target_id ?? '');
  const kind = input.relationship_kind ? String(input.relationship_kind) : undefined;

  if (!state.nodes.some((n) => n.id === source) || !state.nodes.some((n) => n.id === target)) {
    return errorOutcome(state, 'connect requires existing source_id and target_id.');
  }

  const edge: DiagramEdge = {
    id: makeId(),
    source,
    target,
    data: kind
      ? { relationshipKind: kind as DiagramEdgeData['relationshipKind'] }
      : {},
  };
  const edges = [...state.edges, edge];
  const nodes = state.nodes.map((node) =>
    node.id === source || node.id === target
      ? withValidatedData(node, state.nodes, edges)
      : node,
  );

  return {
    state: { nodes, edges },
    content: `Connected ${source} -> ${target}${kind ? ` (${kind})` : ''}.`,
    isError: false,
    mutated: true,
  };
}

function configure(input: Record<string, any>, state: GraphState): OpOutcome {
  const nodeId = String(input.node_id ?? '');
  const patch =
    input.config_patch && typeof input.config_patch === 'object'
      ? (input.config_patch as Record<string, unknown>)
      : null;
  const target = state.nodes.find((node) => node.id === nodeId);

  if (!target) return errorOutcome(state, `configure: node "${nodeId}" not found.`);
  if (!patch) return errorOutcome(state, 'configure requires a config_patch object.');

  const updated = withValidatedData(
    { ...target, data: { ...target.data, config: { ...target.data.config, ...patch } } },
    state.nodes,
    state.edges,
  );
  const nodes = state.nodes.map((node) => (node.id === nodeId ? updated : node));

  return {
    state: { nodes, edges: state.edges },
    content: `Configured ${nodeId}.${summarizeErrors(updated)}`,
    isError: false,
    mutated: true,
  };
}

function setParent(input: Record<string, any>, state: GraphState): OpOutcome {
  const nodeId = String(input.node_id ?? '');
  const parentId = input.parent_id == null ? null : String(input.parent_id);
  const target = state.nodes.find((node) => node.id === nodeId);

  if (!target) return errorOutcome(state, `set_parent: node "${nodeId}" not found.`);
  if (parentId && !state.nodes.some((node) => node.id === parentId)) {
    return errorOutcome(state, `set_parent: parent "${parentId}" not found.`);
  }

  let updated: DiagramNode;
  if (parentId) {
    updated = { ...target, parentNode: parentId, extent: 'parent' };
  } else {
    const { parentNode: _parent, extent: _extent, ...rest } = target as DiagramNode & {
      parentNode?: string;
      extent?: unknown;
    };
    updated = rest as DiagramNode;
  }
  updated = withValidatedData(updated, state.nodes, state.edges);
  let nodes = state.nodes.map((node) => (node.id === nodeId ? updated : node));
  nodes = adjustParentSizes(nodes);

  return {
    state: { nodes, edges: state.edges },
    content: parentId ? `Moved ${nodeId} into ${parentId}.` : `Moved ${nodeId} to the top level.`,
    isError: false,
    mutated: true,
  };
}

function remove(input: Record<string, any>, state: GraphState): OpOutcome {
  const targetId = String(input.target_id ?? '');
  const isNode = state.nodes.some((node) => node.id === targetId);
  const isEdge = state.edges.some((edge) => edge.id === targetId);

  if (!isNode && !isEdge) {
    return errorOutcome(state, `remove: "${targetId}" is not a node or edge.`);
  }

  if (isEdge) {
    return {
      state: { nodes: state.nodes, edges: state.edges.filter((edge) => edge.id !== targetId) },
      content: `Removed edge ${targetId}.`,
      isError: false,
      mutated: true,
    };
  }

  const removed = new Set<string>([targetId, ...getDescendants(targetId, state.nodes)]);
  const nodes = state.nodes.filter((node) => !removed.has(node.id));
  const edges = state.edges.filter(
    (edge) => !removed.has(edge.source) && !removed.has(edge.target),
  );

  return {
    state: { nodes, edges },
    content: `Removed node ${targetId} and ${removed.size - 1} descendant(s).`,
    isError: false,
    mutated: true,
  };
}

export function executeOp(
  opName: string,
  input: Record<string, any>,
  state: GraphState,
): OpOutcome {
  switch (opName) {
    case 'add_resource':
      return addResource(input, state);
    case 'connect':
      return connect(input, state);
    case 'configure':
      return configure(input, state);
    case 'set_parent':
      return setParent(input, state);
    case 'remove':
      return remove(input, state);
    default:
      return errorOutcome(state, `Unknown operation: ${opName}`);
  }
}
```

> Note: read-only ops (`query_graph`, `validate`, `estimate_cost`, `list_services`, `get_service`) are added to the `switch` in Task 5. `readOutcome` is defined now and used there.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/agent/op-executor.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/agent/op-executor.ts client/src/agent/op-executor.test.ts
git commit -m "feat(client): add agent op-executor mutating ops"
```

---

## Task 5: Op-executor — read-only ops

**Files:**
- Modify: `client/src/agent/op-executor.ts`
- Test: `client/src/agent/op-executor.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing test**

Append to `client/src/agent/op-executor.test.ts`:

```typescript
describe('executeOp — read-only ops', () => {
  it('query_graph returns a JSON summary without mutating', () => {
    const added = executeOp('add_resource', { service_id: 'lambda' }, empty());

    const outcome = executeOp('query_graph', {}, added.state);

    expect(outcome.mutated).toBe(false);
    expect(outcome.state).toBe(added.state);
    const parsed = JSON.parse(outcome.content);
    expect(parsed.nodes[0].serviceId).toBe('lambda');
  });

  it('validate reports per-node errors', () => {
    // A lambda with no IAM role violates its declared validation rules.
    const added = executeOp('add_resource', { service_id: 'lambda' }, empty());

    const outcome = executeOp('validate', {}, added.state);

    expect(outcome.isError).toBe(false);
    expect(outcome.content.toLowerCase()).toContain('validation');
  });

  it('estimate_cost returns a dollar figure', () => {
    const added = executeOp('add_resource', { service_id: 'lambda' }, empty());

    const outcome = executeOp('estimate_cost', {}, added.state);

    expect(outcome.content).toContain('$');
  });

  it('list_services lists catalog ids', () => {
    const outcome = executeOp('list_services', {}, empty());

    expect(outcome.content).toContain('lambda');
  });

  it('get_service returns details for a known service', () => {
    const outcome = executeOp('get_service', { service_id: 'lambda' }, empty());

    const parsed = JSON.parse(outcome.content);
    expect(parsed.id).toBe('lambda');
  });

  it('get_service errors on an unknown id', () => {
    const outcome = executeOp('get_service', { service_id: 'nope' }, empty());

    expect(outcome.isError).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/agent/op-executor.test.ts`
Expected: FAIL — read ops fall through to "Unknown operation".

- [ ] **Step 3: Write the implementation**

Add these functions to `client/src/agent/op-executor.ts` (above `executeOp`):

```typescript
function queryGraph(state: GraphState): OpOutcome {
  const summary = {
    nodes: state.nodes.map((node) => ({
      id: node.id,
      serviceId: node.data.serviceId,
      label: node.data.label,
      parent: node.parentNode ?? null,
    })),
    edges: state.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      relationshipKind: edge.data?.relationshipKind ?? null,
    })),
  };
  return readOutcome(state, JSON.stringify(summary));
}

function validateGraph(state: GraphState): OpOutcome {
  const problems: string[] = [];
  for (const node of state.nodes) {
    const validated = withValidatedData(node, state.nodes, state.edges);
    for (const message of Object.values(validated.data.validationErrors)) {
      if (message) problems.push(`${node.data.label} (${node.id}): ${message}`);
    }
  }
  const content = problems.length
    ? `Validation errors:\n- ${problems.join('\n- ')}`
    : 'Validation passed: no errors.';
  return readOutcome(state, content);
}

function estimateCost(state: GraphState): OpOutcome {
  let total = 0;
  for (const node of state.nodes) {
    const profile = registry.find(node.data.serviceId)?.costProfile;
    if (!profile) continue;
    if (profile.estimate) {
      try {
        total += profile.estimate(node.data.config) || 0;
      } catch {
        /* ignore estimator failures in the summary */
      }
    } else if (profile.baseMonthlyCost) {
      total += profile.baseMonthlyCost;
    }
  }
  return readOutcome(state, `Estimated monthly cost: $${Math.round(total * 100) / 100}.`);
}

function listServices(input: Record<string, any>, state: GraphState): OpOutcome {
  const category = input.category ? String(input.category) : null;
  const lines = registry
    .getAll()
    .filter((service) => !category || service.category === category)
    .map(
      (service) =>
        `${service.id} (${service.category}): ${service.aiHints?.summary ?? service.description}`,
    );
  return readOutcome(state, lines.join('\n'));
}

function getService(input: Record<string, any>, state: GraphState): OpOutcome {
  const serviceId = String(input.service_id ?? '');
  const service = registry.find(serviceId);
  if (!service) return errorOutcome(state, `Unknown service_id "${serviceId}".`);

  return readOutcome(
    state,
    JSON.stringify({
      id: service.id,
      name: service.name,
      category: service.category,
      capabilities: service.capabilities,
      allowedParents: service.allowedParents,
      allowedRelationships: service.allowedRelationships,
      isContainer: service.isContainer ?? false,
      aiHints: service.aiHints,
    }),
  );
}
```

Then add the cases to the `executeOp` switch (before `default`):

```typescript
    case 'query_graph':
      return queryGraph(state);
    case 'validate':
      return validateGraph(state);
    case 'estimate_cost':
      return estimateCost(state);
    case 'list_services':
      return listServices(input, state);
    case 'get_service':
      return getService(input, state);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/agent/op-executor.test.ts`
Expected: PASS (14 tests total).

- [ ] **Step 5: Commit**

```bash
git add client/src/agent/op-executor.ts client/src/agent/op-executor.test.ts
git commit -m "feat(client): add agent op-executor read-only ops"
```

---

## Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full frontend test suite**

Run: `cd client && npx vitest run`
Expected: all tests PASS (existing + the new agent suites).

- [ ] **Step 2: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit (only if any fixes were needed)**

```bash
git add -A
git commit -m "chore(client): agent frontend core typecheck + suite green"
```

(If Steps 1–2 are already clean with nothing to stage, skip this commit.)

---

## Done criteria for Plan C1

- [ ] `cd client && npx vitest run` passes.
- [ ] `cd client && npx tsc --noEmit` clean.
- [ ] `buildAgentCatalog()`, `api/agent.ts` (create/send/advance), `executeOp()` (5 mutating + 5 read ops), and `resolveOpRisk()` exist and are unit-tested.

## Hand-off to Plan C2 (agent panel & run loop)

Plan C2 will: expose `addEventListener` on `WebSocketContext` + a `use-agent-events` hook; build the run-controller hook that calls `sendAgentMessage`/`advanceAgentRun`, runs each returned `AgentOp` through `executeOp` (gated by `resolveOpRisk` → confirm card), dispatches `setNodes`/`setEdges` (autosave persists), and collects `AgentOpResult`s for the next `advance`; build the agent panel (chat, requirements tracker, streaming narration from `agent.message.delta`, confirm UI); mount it in the editor with a `useKeyboardShortcuts` toggle; and send `buildAgentCatalog()` on conversation creation.
