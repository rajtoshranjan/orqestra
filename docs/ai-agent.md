# AI Agent

Orqestra ships with an AI agent that designs and edits cloud architecture **on
the same canvas graph a human edits, under the same rules**. It is not a chatbot
bolted onto the side of the editor: every change it makes is a normal, undoable
graph diff, produced through the existing service registry and the same canvas
helpers a drag-and-drop edit uses, and validated by the same engine that
validates human edits.

- **Design-time only.** The agent never deploys. It can prepare and explain a
  deployment; a human triggers it through the existing pipeline.
- **Reactive.** It acts when you chat with it or tag it. There is no background
  watcher.
- **Provider-agnostic twice over.** Cloud resources are plugins (see
  [architecture.md](./architecture.md)) and so are LLMs — swapping models is an
  adapter, not a rewrite.

## Surfaces

### 1. The agent panel (build chat)

A dockable panel in the editor, toggled with **Cmd/Ctrl + J** (registered through
`useKeyboardShortcuts`). It opens automatically once on a brand-new empty project
so you land straight in the guided intake instead of a blank canvas.

The panel is tabbed:

| Tab | Contents |
|-----|----------|
| **Chat** | The project's standalone build conversation — onboarding generation and later global changes ("add a staging environment", "put a CDN in front of the ALB"). |
| **Threads** | An inbox of every canvas-anchored `@orqestra` thread. Selecting one centres the canvas on the annotation and opens its comment popover; the conversation itself continues on the canvas. |

Describe an app in plain terms and the agent builds it live — nodes appear and
get wired on the canvas while the panel narrates each step and shows the
requirements it is still missing (workload · scale · data · regions · compliance
· budget).

### 2. `@orqestra` annotations (anchored edits)

For local, in-place changes, press **C** to enter comment mode and mention
`@orqestra` in a comment on a node, an edge, or the canvas. The agent makes the
change and replies in that same thread, using the existing annotation / comment /
mention / notification system end to end.
Agent replies are `Comment` rows with `author_type = "agent"` and
`origin = "orqestra"`.

Once the agent has been tagged in a thread it stays engaged and follows every
subsequent comment — you don't have to re-tag it on each reply — until the thread
is resolved. Each anchored thread keeps its own conversation
(`AgentConversation.annotation`), so its memory survives a page reload and never
bleeds into the build chat.

## How a run works — server brain, client hands

The agent's reasoning runs on the server; the canvas mutations are materialised
by the client through the frontend service registry and the shared canvas
helpers (`createServiceNode`, parent sizing, `withValidatedData`). That keeps
node defaults, layout, and the React Flow envelope in exactly one place, and
means the agent literally drives the same code paths a human drag-and-drop
does.

```
1. You send a message                    POST /agent/conversations/<id>/send/
        │                                (starts an AgentRun)
        ▼
2. Server runs one LLM turn              agent/engine.py → BaseLLMProvider.stream()
        │
        ▼
3. Model emits graph ops (tool calls)    coarse risk classified server-side
        │                                (agent/risk.py)
        ▼
4. Client applies each op                client/src/agent/op-executor.ts
        │                                → service registry + canvas helpers
        │                                → React Flow → normal project autosave
        ▼
5. Client reports results back           POST /agent/runs/<id>/advance/
        │                                (validation errors, cost deltas, …)
        ▼
6. Model continues or self-corrects      loop back to 2
```

The loop ends when the model stops emitting ops and posts a summary, or when it
hits `AGENT_MAX_TURNS` (default 20). Ops classified as risky pause the loop for
confirmation; the remaining ops in that batch resume after you decide (see
[Risk model](#risk-model)).

The build reads live because the client applies each turn's ops **one at a
time**, with a short beat between them, narrating as it goes — the architecture
visibly assembles instead of appearing in one lump.

The engine also broadcasts run events to the project's Channels group
(`agent.message.delta`, `agent.tool_call`, `agent.op_applied`,
`agent.run.completed`, `agent.run.failed`) through the same real-time transport
deployments use. The editor panel doesn't subscribe to them today — it renders
from the REST turn loop above — but the transport is in place for surfaces that
need to observe a run they didn't start (a second viewer on the project, or a
future server-side executor).

## The action space

The agent never emits raw IaC. Its tools are semantic, provider-agnostic graph
operations declared in `server/agent/tools.py`:

| Tool | Purpose |
|------|---------|
| `list_services(category?)` | Browse the catalog — capabilities, relationships, allowed parents, cost/security hints. |
| `get_service(service_id)` | Full definition for one service. |
| `query_graph()` | Current nodes and edges. |
| `add_resource(service_id, config?, parent_id?, label?)` | Add a node. |
| `connect(source_id, target_id, relationship_kind)` | Add a typed edge. |
| `configure(node_id, config_patch)` | Update a node's config. |
| `set_parent(node_id, parent_id)` | Re-parent (containment). |
| `remove(target_id)` | Delete a node or edge. |
| `validate()` | Run validation — this is the self-correction signal. |
| `estimate_cost()` | Current cost and delta. |

The ops are grounded twice. The system prompt is built from the project's
catalog snapshot and the live canvas, so the model only ever sees real service
ids and real node ids; and the client executes each op through the frontend
service registry, so an unknown service, an illegal parent, or a rejected wiring
comes straight back as an error tool result the model has to correct.

Services are chosen and wired by **capability and relationship** (e.g. "requires
`execution-role`"), never by hardcoded service IDs — the same rule that applies
to platform code. The system prompt also pins the agent to the existing canvas:
it must `query_graph` and edit resources in place rather than recreating what is
already there. Because validation and cost estimation are tools, the platform's
own engines are its feedback loop — it cannot quietly finish on an architecture
the platform itself considers invalid.

## Risk model

Autonomy is graded by blast radius:

- **safe** — applied immediately and undoable like any other canvas edit.
- **confirm** — the run pauses and the panel asks before applying.

Coarse, op-type risk is decided server-side (`server/agent/risk.py`): `remove`
always confirms. The client then merges in finer signal at apply time
(`client/src/agent/risk.ts`), because the profiles it needs live on the frontend
service definitions — today, adding a resource whose `costProfile.tier` is
`high` is escalated to confirm. Security-rule-based grading is a natural
extension of the same function.

A pending confirmation stops the run at that op and holds the rest of the
batch; approving applies it and resumes, declining reports "the user declined
this change" back to the model as the tool result so it can adjust rather than
silently retry.

## Configuration

All LLM credentials live server-side only. Set them in `.env`:

| Variable | Purpose |
|----------|---------|
| `AGENT_LLM_PROVIDER` | Which registered provider to use: `anthropic`, `gemini`, or `ollama`. |
| `AGENT_LLM_MODEL` | Model id passed to that provider. |
| `ANTHROPIC_API_KEY` | Required when the provider is `anthropic`. |
| `GEMINI_API_KEY` | Required when the provider is `gemini`. |
| `OLLAMA_BASE_URL` | Ollama endpoint. Defaults to `http://host.docker.internal:11434`. |
| `OLLAMA_NUM_CTX` | Context window requested from Ollama. Defaults to `32768`. |
| `OLLAMA_READ_TIMEOUT` | Seconds to wait on a local generation. Defaults to `300`. |

`AGENT_MAX_TURNS` (in `server/orqestra/settings.py`) caps how many model turns a
single run may take.

Providers are resolved lazily, so the stack boots fine without a key — the agent
just returns a clear "not configured" error the first time you talk to it.
Restart the server container after changing `.env`.

## Adding an LLM provider

The engine never imports a vendor SDK. It depends on the vendor-neutral types in
`server/agent/llm/types.py` (`LLMMessage`, `ToolSpec`, `ToolResultBlock`, and the
streamed `TextDelta` / `ToolCallRequested` / `Usage` / `Stop` events), so a new
model is an adapter plus a registration:

1. Add `server/agent/llm/{name}_provider.py` with a class extending
   `BaseLLMProvider`: set `name` and `capabilities`, and implement `stream()` to
   yield canonical `LLMEvent`s.
2. Translate to and from the vendor's shapes in `server/agent/llm/mappers.py` —
   nowhere else.
3. Register it in `AgentConfig.ready()` (`server/agent/apps.py`).
4. Select it with `AGENT_LLM_PROVIDER`.

No engine, prompt, tool, or frontend changes are required.
`AnthropicProvider`, `GeminiProvider`, and `OllamaProvider` are the worked
examples.

## Running the agent locally against Ollama

`ollama` needs no API key, so it is the cheapest way to exercise a run
end-to-end. Install Ollama on the host, then:

```
ollama pull qwen3:8b
```

```
AGENT_LLM_PROVIDER=ollama
AGENT_LLM_MODEL=qwen3:8b
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

Then `docker compose up -d --force-recreate server` to pick up `.env`.

Three things matter when picking a model:

- **It must support tool calling.** The agent acts only through its ten
  grounded ops, so a model with no tool template (plain `llama3`, `gemma`,
  most `*-text` variants) can chat but can never touch the canvas. `qwen3`,
  `llama3.1`+, and `mistral-nemo` do support it.
- **Context.** Ollama defaults to a 4096-token window, which silently drops
  the service catalog out of the system prompt. `OllamaProvider` overrides it
  with `OLLAMA_NUM_CTX` — do not lower it below the catalog size.
- **Ollama issues no tool-call ids.** The provider mints them, because the
  engine pairs a `tool_use` to its `tool_result` by id when replaying history.

Small local models follow the multi-step tool protocol less reliably than the
hosted ones. Treat Ollama as a wiring/plumbing check, not a quality bar.

## Data model

| Model | Role |
|-------|------|
| `AgentConversation` | A thread, scoped to a project. `annotation` is null for the build chat and set for a canvas-anchored thread. Stores the client's service-catalog snapshot used for prompting. |
| `AgentMessage` | One turn — `user`, `assistant`, or `tool` — stored as content blocks, with token accounting. |
| `AgentRun` | One loop execution: `running` → `awaiting_client` → `completed` / `failed`, plus turn and token counts. |

An abandoned run can leave an assistant `tool_use` block with no matching
`tool_result`, which most LLM APIs reject outright. The engine repairs history on
load (`_repair_history`) by dropping unmatched pairs, so a closed panel or a
dropped connection can't permanently poison a conversation.

## API

All routes are under `/agent/`, scoped to the active organisation and gated by
the standard organisation permissions (`IsOrganisationMember` to read,
`CanWriteOrganisation` to act).

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/agent/conversations/` | List conversations. Filters: `project`, `standalone=true` (build chats only), `annotation`. |
| `POST` | `/agent/conversations/` | Start a conversation, optionally anchored to an annotation. |
| `GET` | `/agent/conversations/<id>/` | Full transcript, for rehydrating the panel. |
| `POST` | `/agent/conversations/<id>/send/` | Send a user message with the live graph snapshot; starts a run. |
| `POST` | `/agent/runs/<id>/advance/` | Report op results and take the next turn. |
| `POST` | `/agent/annotations/<id>/reply/` | Post the agent's reply into a comment thread. |

Requests carry the client's live canvas snapshot (`graph`) so the model reasons
about exactly what you see; the persisted project graph is the fallback.

## Tests

```bash
docker compose run --rm server python manage.py test agent
cd client && npm test
```

The backend suite covers the engine loop, tools, prompts, risk, serializers,
events, both providers, and the annotation reply path, using a fake provider
(`server/agent/tests/fakes.py`) — no API key or network needed. The frontend
suite covers the op executor, run loop, risk resolution, inbox derivation,
annotation triggering, and error parsing.

## Related documents

- [architecture.md](./architecture.md) — platform architecture and the service plugin model
- [Design spec](./superpowers/specs/2026-06-16-ai-agent-design.md) — the decisions behind this feature
- [Agent inbox spec](./superpowers/specs/2026-06-19-unified-agent-inbox-design.md) — the tabbed panel and conversation↔annotation linkage
