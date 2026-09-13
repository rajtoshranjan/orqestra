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
        │                                (starts an AgentRun; refused with 409
        │                                 while one is already live)
        ▼
2. Server runs one LLM turn              agent/engine.py → BaseLLMProvider.stream()
        │
        ▼
3. Read-only operations resolve server-side     list_services / get_service /
        │                                query_graph answered from the stored
        │                                catalog and the posted graph, then the
        │                                loop takes another turn immediately —
        │                                no round trip, no turn spent
        ▼
4. Mutating operations go to the client         coarse risk classified server-side
        │                                (agent/risk.py), refined at apply time
        ▼
5. Client applies each operation                client/src/agent/operation-executor.ts
        │                                → shared graph rules + service registry
        │                                → React Flow → normal project autosave
        ▼
6. Client reports results back           POST /agent/runs/<id>/advance/
        │                                (only for outstanding tool calls; the
        │                                 server drops duplicates and strays)
        ▼
7. Model continues or self-corrects      loop back to 2
```

The loop ends when the model stops emitting operations and posts a summary, when you
press **Stop**, or when it hits `AGENT_MAX_TURNS` (default 20). Operations classified as
risky pause the loop for confirmation; the remaining operations in that batch resume
after you decide (see [Risk model](#risk-model)).

A run is a state machine — `running` → `awaiting_client` → `completed` /
`failed` / `cancelled` — and the API enforces it: only a run awaiting the client
can be advanced, and results are accepted only for tool calls that are actually
outstanding, so a retried request can't write a duplicate `tool_result` that
poisons the replayed history. A run abandoned mid-flight (a closed tab) is
retired after `AGENT_RUN_STALE_MINUTES` so it can never block the conversation.

The build reads live because the client applies each turn's operations **one at a
time**, with a short beat between them, narrating as it goes — the architecture
visibly assembles instead of appearing in one lump.

The engine also broadcasts run events to the project's Channels group
(`agent.message`, `agent.tool_call`, `agent.operation_applied`, `agent.run.completed`,
`agent.run.failed`) through the same real-time transport deployments use. One
`agent.message` is emitted per completed turn rather than per token — a
delta-rate broadcast put a channel-layer round trip on the hot path for every
token, into a group nothing consumes. The editor panel renders from the REST
turn loop above; the transport is in place for surfaces that need to observe a
run they didn't start.

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

`list_services`, `get_service` and `query_graph` are answered **server-side**
from the catalog snapshot stored on the conversation and the graph posted with
the request, and the loop continues without returning to the browser. Only
mutations, `validate` and `estimate_cost` reach the client — the latter two
because they need the frontend registry's validators and cost estimators.

The operations are grounded twice. The system prompt carries each service's
capabilities, allowed parents, allowed relationships and summary — not just its
id — so the model can select and wire by capability without spending turns
looking things up. And the client executes each operation through the same
`checkConnection` / `checkParent` rules a human drag-and-drop goes through
(`client/src/utils/graph-rules.ts`), so an unknown service, an illegal parent or
a rejected wiring comes straight back as an error tool result the model has to
correct.

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

Coarse, operation-type risk is decided server-side (`server/agent/risk.py`): `remove`
always confirms. The client then merges in finer signal at apply time
(`client/src/agent/risk.ts`), because the profiles it needs live on the frontend
service definitions:

- adding a resource whose `costProfile.tier` is `high`;
- a `configure` whose patch touches a security- or cost-sensitive field
  (exposure, encryption, retention, instance class, capacity …). A service can
  name its own with `sensitiveConfigKeys`.

A pending confirmation stops the run at that operation and holds the rest of the
batch; approving applies it and resumes, declining reports "the user declined
this change" back to the model as the tool result so it can adjust rather than
silently retry. The confirmation card names the actual target and what else the
change takes with it ("Remove Prod VPC · also affects 3 nested resources and 4
connections") — approving a change you can't see is worse than no gate at all.

In an anchored thread the confirmation happens **in the thread**: the run pauses,
the agent asks, and your next comment answers it ("yes" applies, anything else
declines). Anchored threads can therefore do the full action space, deletions
included.

## Setup

The agent needs a model to talk to. That is configured **in the app**, not in
the environment: credentials belong to an organisation, so one server can serve
many of them, and an org admin can change models without a redeploy.

> **Upgrading?** Model settings used to live in `.env`
> (`AGENT_LLM_PROVIDER`, `AGENT_LLM_MODEL`, `ANTHROPIC_API_KEY`, …). Those
> variables are gone and are no longer read. Each organisation must add its
> model once through the UI below; nothing is imported automatically.

### 1. Add a model

**Settings → AI Models → Add model.** Owners and admins only — these are
credentials. Regular members can see which models exist; guests cannot.

| Field | Notes |
|-------|-------|
| **Name** | How it appears in the list, e.g. "Claude Sonnet 5". |
| **Provider** | `Anthropic`, `Google Gemini`, or `Ollama`. |
| **Model id** | Passed to the provider verbatim — `claude-sonnet-5`, `gemini-2.5-flash`, `qwen3:8b`. |
| **Endpoint URL** | Ollama only. `https://ollama.com` for cloud, or an address your **server container** can reach for local — usually `http://host.docker.internal:11434`, not `localhost`. |
| **API key** | Required for Anthropic and Gemini. Optional for a local Ollama endpoint. Stored encrypted; never returned to the browser. |
| **Context window** | Ollama local only. Its 4096 default truncates the service catalog out of the prompt, so set something like `32768`. |

Press **Test connection** before saving. It makes one cheap call and reports
back, so a wrong key or a model id the provider doesn't serve surfaces here
rather than on someone's first message.

The first model an organisation adds becomes its default automatically.

### 2. Pick which model a project uses

Every project uses the organisation default unless it says otherwise. To
override it for one project, open **Project settings → AI model** and choose
from the list; "Use organisation default" hands it back.

Resolution order, per run:

```
project.llm_config  →  organisation default  →  error asking an admin to add one
```

### 3. Check it works

Open a project, press **Cmd/Ctrl + J**, and send *"add a Lambda"*. A node should
appear on the canvas within a few seconds.

## Configuration reference

Model choice and credentials are **not** environment variables. What remains in
`.env` are operator-level safety limits, deliberately kept out of the UI so an
organisation admin cannot raise a timeout that ties up a server worker.

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGENT_MAX_TURNS` | `20` | Model turns one request may take. Reads are answered server-side, so this budget is spent on decisions rather than lookups. |
| `AGENT_MAX_OUTPUT_TOKENS` | `8192` | Cap on a single turn's output. A turn that hits this fails the run with a "truncated" error rather than looking like a clean finish. |
| `AGENT_REQUEST_TIMEOUT` | `120` | Seconds to wait on a hosted provider before failing the run. The turn runs inside a request, so this bounds how long a worker is held. |
| `OLLAMA_READ_TIMEOUT` | `300` | Seconds to wait on an Ollama generation. Local models are slow, so this is deliberately more generous. |
| `AGENT_RUN_STALE_MINUTES` | `10` | How long before a run abandoned mid-flight (a closed tab) is retired, so it can't block its conversation. |

## Troubleshooting

| What you see | What it means |
|--------------|---------------|
| *"No AI model is configured for this organisation"* | Nobody has added one. Settings → AI Models → Add model. |
| *"This … model has no API key"* | The stored config has no key. Edit it and add one. |
| A 404 or "model not found" from the provider | The **Model id** isn't one that provider serves. Check it against the provider's current model list. |
| *"has no tool-calling support"* (Ollama) | The model has no tool template, so it can chat but can never touch the canvas. Pick a tool-capable model — see below. |
| *"Cannot reach Ollama at …"* | The **server container** can't see that endpoint. A host-local Ollama is `http://host.docker.internal:11434`, not `localhost`. |
| *"The model's response was truncated"* | The turn hit `AGENT_MAX_OUTPUT_TOKENS`. Ask for a smaller change, or raise it. |
| *"Exceeded the maximum of N steps"* | The run hit `AGENT_MAX_TURNS`. Usually means the model is looping; try a more specific request. |
| *"This conversation already has a run in progress"* | A run is still live. Press **Stop**, or wait — an abandoned one is retired after `AGENT_RUN_STALE_MINUTES`. |
| The agent replies but nothing appears on the canvas | You have read-only access to the project, or the canvas is locked. The agent respects both. |

## Where credentials live

`organisations.LLMConfig`, alongside `AWSAccount` and following the same rules:

- Encrypted at rest with `encrypt_val` (Fernet, keyed off `SECRET_KEY`), and
  decrypted only in `build_provider` — plaintext exists for the life of one
  provider instance.
- Never returned by the API. The serializer exposes `has_api_key`, not the key,
  so an edit form cannot leak it and a blank key on update keeps the stored one.
- Managed by owners and admins (`CanManageOrganisation`), readable by non-guest
  members, and every change writes an `AuditLog` entry.

## Adding an LLM provider

The engine never imports a vendor SDK. It depends on the vendor-neutral types in
`server/agent/llm/types.py` (`LLMMessage`, `ToolSpec`, `ToolResultBlock`, and the
streamed `TextDelta` / `ToolCallRequested` / `Usage` / `Stop` events), so a new
model is an adapter plus a registration:

1. Add `server/agent/llm/{name}_provider.py` with a class extending
   `BaseLLMProvider`: set `name` and `capabilities`, and implement `stream()` to
   yield canonical `LLMEvent`s. Credentials arrive through the base
   constructor (`model`, `api_key`, `base_url`, `context_window`) — never read
   them from the environment.
2. Translate to and from the vendor's shapes in `server/agent/llm/mappers.py` —
   nowhere else.
3. Register the **class** (not an instance) in `AgentConfig.ready()`
   (`server/agent/apps.py`): one process serves many organisations, so a
   provider is built per run.
4. Add it to `LLMProviderChoice` (`server/organisations/constants.py`) and to
   `LLM_PROVIDERS` in `client/src/api/llm-configs.ts` so admins can pick it in
   Settings → AI Models. Declare whether it needs an API key or a base URL in
   the same two places.

No engine, prompt, tool, or frontend changes are required.
`AnthropicProvider`, `GeminiProvider`, and `OllamaProvider` are the worked
examples.

Three things every adapter owes the engine:

- **Yield a `Stop` event** carrying the vendor's finish reason. The engine uses
  it to tell a truncated turn from a finished one.
- **Give every tool call an id**, via `ensure_tool_call_id()` in `mappers.py`.
  The engine pairs a `tool_use` to its `tool_result` by id when replaying
  history, so calls without ids collide and results get attributed to the wrong
  call. Neither Ollama nor Gemini issues one.
- **Report `capabilities.max_context_tokens` honestly.** The engine budgets
  replayed history against it, keeping the opening request and the most recent
  turns.

`cacheable_prefix` is optional: it is the leading slice of the system prompt
(the service catalog) that is byte-identical across a run. Adapters whose vendor
supports prompt caching should mark it as a cache breakpoint; the rest ignore
it, since it is already part of `system_prompt`.

## Choosing an Ollama model

`ollama` needs no API key for a local endpoint, so it is the cheapest way to
exercise a run end-to-end. Install Ollama on the host, then:

```bash
ollama pull qwen3:8b
```

Three things matter when picking a model:

- **It must support tool calling.** The agent acts only through its grounded
  operations, so a model with no tool template (plain `llama3`, `gemma`, most
  `*-text` variants) can chat but can never touch the canvas. `qwen3`,
  `llama3.1`+, and `mistral-nemo` do support it.
- **Context.** Ollama defaults to a 4096-token window, which silently drops the
  service catalog out of the system prompt. Set **Context window** on the model
  config (32768 is a good starting point) — it applies to local endpoints only,
  since hosted models manage their own. Don't set it below the catalog size:
  the catalog carries each service's capabilities and relationships, so it is
  the largest part of the prompt.
- **Multi-step discipline.** Small local models follow the tool protocol less
  reliably than the hosted ones. Treat Ollama as a wiring/plumbing check, not a
  quality bar.

## Data model

| Model | Role |
|-------|------|
| `AgentConversation` | A thread, scoped to a project. `annotation` is null for the build chat and set for a canvas-anchored thread. Stores the client's service-catalog snapshot used for prompting. |
| `AgentMessage` | One turn — `user`, `assistant`, or `tool` — stored as content blocks, with token accounting. |
| `AgentRun` | One loop execution: `running` → `awaiting_client` → `completed` / `failed`, plus turn and token counts. |

`AgentMessage.run` links each message to the run that produced it, which is what
lets the annotation endpoint post exactly what a run said.

An abandoned run can leave an assistant `tool_use` block with no matching
`tool_result`, which most LLM APIs reject outright, and a model turn that returns
nothing at all would persist an empty content block — equally fatal, and not
something any repair pass used to remove. The engine now refuses to write an
empty assistant message, and repairs history on load (`_repair_history`) by
dropping both unmatched pairs and empty messages, so neither a closed panel nor
a silent turn can permanently poison a conversation.

History is also budgeted against the provider's declared
`max_context_tokens`: the opening request and the most recent turns are kept and
the middle is dropped, so a long build chat degrades instead of failing. On
Anthropic the catalog block is sent as a cached prefix, since it is
byte-identical on every turn of a run.

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
| `POST` | `/agent/runs/<id>/advance/` | Report operation results and take the next turn. |
| `POST` | `/agent/runs/<id>/cancel/` | Stop a run. The engine checks before each turn. |
| `POST` | `/agent/annotations/<id>/reply/` | Post the agent's reply into a comment thread. Takes a `run`, not a body: the text is derived server-side from that run's own narration, error, or pending confirmation, so a comment carrying the agent's name is always something the agent actually said. |

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
suite covers the operation executor, run loop, risk resolution, inbox derivation,
annotation triggering, and error parsing.

## Related documents

- [architecture.md](./architecture.md) — platform architecture and the service plugin model
- [Design spec](./superpowers/specs/2026-06-16-ai-agent-design.md) — the decisions behind this feature
- [Agent inbox spec](./superpowers/specs/2026-06-19-unified-agent-inbox-design.md) — the tabbed panel and conversation↔annotation linkage
