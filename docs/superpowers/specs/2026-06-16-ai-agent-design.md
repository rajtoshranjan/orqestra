# Orqestra AI Agent — Design Spec

**Date:** 2026-06-16
**Status:** Approved (design); pending implementation plan
**Topic:** AI agent integrated into the visual IaC editor

---

## 1. Overview

Add an AI agent to Orqestra that turns a conversation into a deployable cloud
architecture and edits that architecture in place. The agent is not a generic
chatbot bolted onto the side — it is **an actor that edits the same canvas graph
a human does, under the same rules**. Every change it makes is a visible,
undoable graph diff, validated by the same engines that validate human edits.

### Goals

- Remove the blank-canvas + cloud-expertise problem for the target user
  (DevOps engineers with limited cloud depth): describe an app in plain terms,
  watch a correct, validated architecture get built on the canvas.
- Make the agent feel native: it speaks through the platform's existing
  primitives (the graph, annotations, real-time events), not a separate UI silo.
- Keep the agent honest: it operates only through the service registry and
  `GraphEngine`, so it cannot produce invalid or undeployable infrastructure —
  the validation/cost/security engines are its guardrails and its self-correction
  loop.
- Provider-agnostic at two layers: cloud providers (already) **and** LLM
  providers (new) — swapping or adding a model is a plug-in, not a rewrite.

### Non-goals (v1)

- The agent does **not** deploy. It is design-time only. It may prepare and
  explain a deployment, but a human triggers it via the existing pipeline.
- No proactive/background reviewer in v1 (agent is reactive: it acts when
  chatted with or tagged). Proactive review is phase 2.
- No multi-cloud generation beyond the existing AWS catalog.

---

## 2. Decisions locked during brainstorming

| Dimension | Decision |
|---|---|
| Primary user | DevOps engineers with limited cloud depth — agent explains its reasoning and owns the deep wiring (IAM, VPC, encryption). |
| Build style | **Watch it build live** — nodes appear and get wired on the canvas in real time, narrated. |
| Autonomy | **Graded by risk** — safe edits apply instantly (undoable); destructive/costly/security-sensitive/live-resource edits require confirm. |
| Initiative | **Reactive only** in v1 (no background watcher). |
| Chat surface | **Persistent dockable panel** — onboarding generation *and* ongoing global changes. |
| Intake | **Guided + conversational** — feels like chat, but tracks the slots it needs so nothing critical is missed. |
| Execution architecture | **Server brain + client hands** (see §4). |
| LLM coupling | **Provider-agnostic** — `BaseLLMProvider` + registry (see §5). |

---

## 3. User-facing surfaces

### 3.1 Agent panel (chat)

A dockable side panel in the editor, available any time.

- **Onboarding generation:** on a new/empty project, the agent runs a
  guided-conversational intake. A lightweight **requirements tracker** shows the
  slots it needs and their state: workload type · scale/traffic · data &
  persistence · region(s) · compliance · budget. The conversation feels natural;
  the tracker exists so nothing critical is silently skipped.
- **Generate / Apply action:** once the agent has enough, a primary action kicks
  off the build. The build **streams live onto the canvas** while the agent
  narrates each step in the panel ("Adding a VPC with two private subnets across
  AZs…", "Wiring the Lambda's execution role…").
- **Ongoing changes:** the same panel handles later global requests ("add a
  staging environment", "put a CDN in front of the ALB").
- Panel toggle is a keyboard shortcut, registered through `useKeyboardShortcuts`.

### 3.2 Annotation tagging (anchored edits)

For local, in-place edits the user mentions the agent in an annotation on a
node/edge/canvas. The agent performs the change (risk-graded) and **replies in
the same thread**; the thread can then be resolved.

- Reuses the existing annotation / comment / mention / notification system end to
  end (`server/annotations`, `client/src/pages/editor/comments`).
- Agent replies are `Comment` rows with `author_type = "agent"` and
  `origin = "<agent-id>"` (both already modelled).
- Mention grammar is extended from user-only to also address the agent (see
  §8.2).

---

## 4. Execution architecture — server brain + client hands

The agent's reasoning runs server-side; the canvas mutations are materialized by
the client through the *existing* frontend registry and `GraphEngine`. This was
chosen over a fully server-authored graph to avoid duplicating node defaults,
layout, and the React Flow node envelope on the backend, and to make the agent
literally drive the same code paths a human does. The op interface is designed so
a future server-authored executor (needed for the phase-2 proactive reviewer) can
run the same ops without a client present.

### Loop

1. User sends a message (REST) → server starts an `AgentRun`.
2. Server runs the LLM tool-use loop via the configured `BaseLLMProvider`.
3. Model emits a tool call (a graph op, see §6). Server **grounds** it against the
   backend registry (service exists? relationship allowed?) and applies coarse
   op-type risk rules (e.g. `remove` always confirms). Fine-grained risk that
   depends on `costProfile` / `securityRules` is computed client-side at apply
   time (§9), since those profiles live on the frontend service definitions today.
4. Server streams the op to the client over Channels (§7).
5. Client applies the op via the frontend registry + `GraphEngine`
   (`createDefaultConfig` + config patch, auto-layout for position, edges with
   `relationshipKind`), updates React Flow, persists via the normal
   `updateProject` save path, runs client-side validation for display, and
   **reports the op result back** (REST).
6. Server feeds the result (including validation errors and cost delta) to the
   model as the tool result → the model continues or self-corrects.
7. Loop ends when the graph validates and requirements are met; the model posts a
   summary. Risky ops pause the loop for confirmation (§9).

### Rejected alternatives

- **Fully server-authored graph:** mutation server-side too. Durable and
  headless-ready, but duplicates node-shaping/layout on the backend and risks
  registry divergence. Deferred to phase 2 as an alternate executor behind the
  same op interface.
- **Client-orchestrated (LLM called from the browser):** rejected — leaks API
  keys and puts business logic in the wrong layer.

---

## 5. LLM provider abstraction (multi-LLM)

The agent engine never imports a vendor SDK directly. It depends on a
vendor-neutral interface and a registry, mirroring the cloud-service provider
pattern (`server/cloud_services/registry.py`). Adding or swapping a model is a new
adapter + registration; **no engine changes**.

### Canonical, vendor-neutral types

- `LLMMessage(role, content_blocks)` — roles: `user` / `assistant` / `tool`.
- `ToolSpec(name, description, json_schema)` — our graph ops as a neutral schema.
- `ToolResult(tool_call_id, content, is_error)`.
- `LLMEvent` (streamed): `TextDelta`, `ToolCallRequested(id, name, input)`,
  `Usage(input_tokens, output_tokens)`, `Stop(reason)`.

### Interface

```python
class BaseLLMProvider(ABC):
    name: str
    capabilities: LLMCapabilities  # supports_streaming, supports_tools, max_context

    async def stream(
        self,
        *,
        system_prompt: str,
        messages: list[LLMMessage],
        tools: list[ToolSpec],
        temperature: float,
        max_tokens: int,
    ) -> AsyncIterator[LLMEvent]:
        ...
```

- **`AnthropicProvider` (v1):** wraps the Anthropic SDK; maps canonical tools →
  Anthropic `tools`, and `content_block_delta` / `tool_use` / `message_delta`
  stream events → canonical `LLMEvent`s. Default model `claude-opus-4-8`.
- **Registry / factory:** `llm_registry.register(provider)`; the active provider +
  model are chosen via settings (`AGENT_LLM_PROVIDER`, `AGENT_LLM_MODEL`). Adding
  GPT / Gemini / etc. = a new adapter class implementing `BaseLLMProvider` +
  registration. Prompt assembly stays provider-neutral; adapters only translate.
- API keys live server-side only, in settings/env.

---

## 6. Tool / op interface (the agent's action space)

Tools are **semantic, provider-agnostic graph operations** grounded in the
service registry — the model never emits raw IaC.

| Tool | Purpose |
|---|---|
| `list_services(category?)` | Browse the catalog (capabilities, relationships, allowed parents, cost/security hints). |
| `get_service(service_id)` | Full definition for one service. |
| `query_graph()` | Current nodes/edges summary. |
| `add_resource(service_id, config?, parent_id?, label?)` | Add a node. |
| `connect(source_id, target_id, relationship_kind)` | Add a typed edge. |
| `configure(node_id, config_patch)` | Update a node's config. |
| `set_parent(node_id, parent_id)` | Re-parent (containment). |
| `remove(target_id)` | Delete a node or edge. |
| `validate()` | Run validation; returns errors (the self-correction signal). |
| `estimate_cost()` | Returns current cost + delta. |

The model selects services and wires them by **capability / relationship** (e.g.
"requires `execution-role`"), never by hardcoded service IDs — consistent with the
platform's anti-patterns.

---

## 7. Streaming & transport

Reuse the existing Django Channels layer (`server/realtime/`), project-scoped
group. Add a `send_agent_event(project_id, event_type, payload)` helper alongside
the existing `send_annotation_event` / `send_deployment_event`.

New event types:

- `agent.message.delta` — streamed assistant text.
- `agent.tool_call` — the op the agent is about to run (drives narration).
- `agent.op_applied` — applied op + resulting node/edge (client renders).
- `agent.confirm_required` — a risky op awaiting confirmation (§9).
- `agent.done` — run complete, with summary + cost.
- `agent.error` — failure.

The client applies each op through the frontend registry, persists via the normal
save path, and posts the op result back (REST) so the server can continue the loop.

---

## 8. Data model (server)

All ops mutate the same `Project.nodes` / `Project.edges` JSON — the canvas
remains the single source of truth. No infrastructure state that can diverge from
the graph is introduced.

### 8.1 New models (`server/agent/`)

- **`AgentConversation`** — `project` FK, `created_by`, `title`, `status`. The
  panel thread; the onboarding chat is just the first conversation.
- **`AgentMessage`** — `conversation` FK, `role` (user/assistant/tool),
  `content`, `tool_calls` (JSON), token/cost usage, `created_at`.
- **`AgentRun`** — one loop execution; links to a conversation **or** an
  annotation; tracks ops applied, cost, `status`, `error`. The annotation surface
  reuses the same engine and posts its result as a `Comment`.

### 8.2 Annotation reuse + agent mentions

- Agent replies = `Comment(author_type="agent", origin="<agent-id>")` (fields
  already exist).
- Extend the mention token grammar to also address the agent. Current:
  `@[Name](user:<uuid>)` (`MENTION_TOKEN_RE` in
  `server/annotations/constants.py`, mirror in
  `client/src/utils/comment-text.ts`). Add an agent target, e.g.
  `@[Orqestra](agent:<agent-id>)`, updating both regexes and the mention picker.
- On completion the agent notifies the requester via the existing `Notification`
  model.

---

## 9. Risk grading & guardrails

`risk = f(op_type, service.costProfile, service.securityRules, target_is_deployed)`.

**Where it's computed:** coarse op-type rules apply server-side (e.g. `remove`
always confirms); fine-grained risk that reads `costProfile` / `securityRules`
is computed **client-side at apply time**, because those profiles live on the
frontend service definitions today. The client raises `agent.confirm_required`
back through the server, which pauses the loop. (When the phase-2 server-authored
executor lands, these profiles must be mirrored into the backend registry so risk
can be graded without a client.)

- **Instant (safe), undoable:** add/configure low-cost, non-security-sensitive
  resources; wiring relationships.
- **Confirm required:** `remove`; high-cost-profile resources;
  security-sensitive changes; any change to a resource that is currently
  deployed (touches live infra). Confirmation is a card (in panel or annotation
  reply) showing a diff (added / removed / changed) + cost delta → Apply / Discard.
- **No deploys in v1** — hard guardrail. The agent can prepare/explain; the human
  triggers deployment.
- Per-run cost (LLM tokens) tracked on `AgentRun` for future org/project limits.

---

## 10. Error handling

- **Validation errors** → fed back to the model for self-correction, with
  **bounded retries**. If it can't fully resolve, it states what it tried and
  what remains rather than looping forever.
- **LLM / tool errors** → graceful message in the panel/annotation; partial work
  stays on the canvas (undoable).
- **Client disconnect mid-run** → run pauses; conversation/run persisted; resume
  or restart on reconnect.
- **Abandoned confirm** → pending risky op discarded; the agent notes it.

---

## 11. Security & cost

- LLM API keys server-side only.
- All agent endpoints enforce org/project membership and scope querysets, like
  the rest of the platform; the agent operates within the requester's permissions.
- Token spend recorded per `AgentRun`; surfaced for future budgeting/limits.

---

## 12. Testing strategy

- **Backend:** agent engine driven by a **stubbed `BaseLLMProvider`** (scripted
  tool-calls) → assert ops, validation/self-correction loop, risk grading,
  persistence. Mention-token parsing. Channels event emission (extend existing
  `server/realtime/tests.py`). Use existing test base classes
  (`docs/agents/testing.md`).
- **Frontend:** op-executor applies ops correctly via the registry; streaming
  reducer; confirm card; agent-mention rendering.
- **Eval-style golden prompts** (e.g. "web app + Postgres + background jobs")
  asserting the result **validates** and contains expected *capabilities*
  (structural invariants, not an exact graph — output is non-deterministic).

---

## 13. Scope & phasing

### v1 (this spec)

Agent panel (guided onboarding generation + ongoing changes) · annotation-tagging
edits · server brain + client hands · provider-agnostic LLM layer · risk-graded
autonomy · reactive only · design-time only.

Suggested implementation slices:

- **Slice A** — LLM provider abstraction + agent engine + tool/op layer + Channels
  streaming + agent panel + onboarding "watch it build".
- **Slice B** — annotation-tagging edits + agent mentions + risk-graded confirm UI
  + ongoing-changes flow.

### Phase 2 (noted, not specced)

Proactive reviewer (server-authored executor behind the same op interface — runs
without a client) · agent-initiated annotations · deploy preparation/triggering ·
multi-cloud generation.

---

## 14. Conventions to honor

- API contract: frontend camelCase / backend snake_case; payloads through
  `apiDataResponseMapper`, `apiPayloadMapper`, `dynamicFieldsPayloadMapper`.
- All graph traversal through `GraphEngine`; never hardcode service IDs in
  framework code — use capabilities / relationships.
- Backend ops via `docker compose run --rm server python manage.py ...`.
- Frontend filenames kebab-case; constants SCREAMING_SNAKE_CASE.
- No patch-fixes to suppress type/lint errors; reuse before creating.
