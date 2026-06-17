# AI Agent — Core Engine Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the provider-agnostic, server-side "brain" of the Orqestra AI agent — the LLM abstraction, conversation/run data model, graph-op tool schema, risk classifier, prompt assembly, and the turn-by-turn engine loop — all testable in isolation with a fake LLM provider (no HTTP/WebSocket yet).

**Architecture:** Server brain + client hands, realized as a **client-driven step loop**. The engine runs exactly one LLM turn per `advance()` call: it ingests the previous turn's tool results, calls the active `BaseLLMProvider`, persists the assistant message, classifies each returned graph op by coarse risk, emits lifecycle events through an injected `event_sink`, and returns the ops for the caller (the API layer, in Plan B) to relay to the client. The engine never mutates the graph — the client applies ops and reports results back on the next `advance()`.

**Tech Stack:** Django 5 / DRF, Python 3.12, Anthropic Python SDK (provider-agnostic behind `BaseLLMProvider`), Postgres (JSONB), existing `BaseModel`/`BaseTestCase` conventions.

**Scope boundaries (this plan):**
- IN: `agent` Django app; `agent/llm/` abstraction + Anthropic adapter; models `AgentConversation` / `AgentMessage` / `AgentRun`; graph-op `ToolSpec`s; coarse risk classifier; system-prompt assembly; `AgentEngine.advance()`; a `FakeLLMProvider` for tests.
- OUT (later plans): REST endpoints + serializers + permissions (Plan B); `send_agent_event` Channels wiring (Plan B injects it into `event_sink`); all frontend work (Plan C); annotation-tagging surface + fine-grained cost/security risk (Slice B).

**Conventions to honor:** backend ops via `docker compose run --rm server python manage.py ...`; no raw exceptions (use DRF/`orqestra.exceptions`); enums mirror `annotations/constants.py` (`.choices()` classmethod); reuse `BaseModel`; tests subclass `orqestra.tests.BaseTestCase` (or plain `TestCase` where no HTTP is needed).

---

## File Structure

```
server/agent/
  __init__.py
  apps.py                      # AgentConfig.ready() registers LLM providers
  constants.py                 # ConversationStatus, MessageRole, RunStatus, RiskLevel, event-type constants
  models.py                    # AgentConversation, AgentMessage, AgentRun
  tools.py                     # graph_tool_specs() -> list[ToolSpec]
  risk.py                      # classify_op_risk()
  prompts.py                   # build_system_prompt()
  engine.py                    # OpRequest, AdvanceResult, AgentEngine
  llm/
    __init__.py
    types.py                   # canonical vendor-neutral types + content (de)serialization
    base.py                    # BaseLLMProvider, LLMCapabilities
    registry.py                # LLMProviderRegistry, llm_registry, get_active_provider()
    mappers.py                 # canonical -> Anthropic request mapping (pure functions)
    anthropic_provider.py      # AnthropicProvider(BaseLLMProvider)
  migrations/
    __init__.py
    0001_initial.py            # generated
  tests/
    __init__.py
    fakes.py                   # FakeLLMProvider, recording event sink
    test_llm_types.py
    test_registry.py
    test_mappers.py
    test_anthropic_provider.py
    test_models.py
    test_tools.py
    test_risk.py
    test_prompts.py
    test_engine.py
    test_integration.py
```

Edits to existing files: `server/requirements.txt`, `server/orqestra/env_variables.py`, `server/orqestra/settings.py`.

---

## Task 1: Scaffolding — dependency, app, settings, env vars

**Files:**
- Modify: `server/requirements.txt`
- Modify: `server/orqestra/env_variables.py`
- Modify: `server/orqestra/settings.py`
- Create: `server/agent/__init__.py` (empty)
- Create: `server/agent/apps.py`
- Create: `server/agent/llm/__init__.py` (empty)
- Create: `server/agent/tests/__init__.py` (empty)

- [ ] **Step 1: Add the Anthropic SDK dependency**

Append to `server/requirements.txt`:

```
anthropic==0.42.0
```

- [ ] **Step 2: Add agent env variables**

In `server/orqestra/env_variables.py`, add inside the `EnvVariable` enum (after the Redis block):

```python
    # Agent / LLM Variables.
    AGENT_LLM_PROVIDER = os.environ.get("AGENT_LLM_PROVIDER", "anthropic")
    AGENT_LLM_MODEL = os.environ.get("AGENT_LLM_MODEL", "claude-opus-4-8")
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
```

- [ ] **Step 3: Wire settings + register the app**

In `server/orqestra/settings.py`, add `"agent",` to `INSTALLED_APPS` (after `"realtime",`). Then add agent settings near the bottom (after the `CHANNEL_LAYERS` block):

```python
# Agent / LLM
AGENT_LLM_PROVIDER = EnvVariable.AGENT_LLM_PROVIDER.value
AGENT_LLM_MODEL = EnvVariable.AGENT_LLM_MODEL.value
ANTHROPIC_API_KEY = EnvVariable.ANTHROPIC_API_KEY.value
AGENT_MAX_TURNS = 20
```

- [ ] **Step 4: Create the app config**

`server/agent/apps.py`:

```python
from django.apps import AppConfig


class AgentConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "agent"

    def ready(self):
        # Register LLM providers on startup. Import here to avoid app-registry
        # import-time issues.
        from .llm.anthropic_provider import AnthropicProvider
        from .llm.registry import llm_registry

        llm_registry.register(AnthropicProvider())
```

Create empty files: `server/agent/__init__.py`, `server/agent/llm/__init__.py`, `server/agent/tests/__init__.py`.

> Note: `AnthropicProvider` is created in Task 5; `apps.ready()` will only import cleanly once Task 5 is done. Run the verification command in Step 5 **after Task 5**, or temporarily comment the body of `ready()` until then. (If executing strictly in order, expect Step 5 to fail until Task 5 lands — that is acceptable; re-run it after Task 5.)

- [ ] **Step 5: Rebuild the image and verify Django loads (re-run after Task 5)**

Run: `docker compose build server && docker compose run --rm server python manage.py check`
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 6: Commit**

```bash
git add server/requirements.txt server/orqestra/env_variables.py server/orqestra/settings.py server/agent/__init__.py server/agent/apps.py server/agent/llm/__init__.py server/agent/tests/__init__.py
git commit -m "feat(agent): scaffold agent app, deps, and settings"
```

---

## Task 2: Canonical LLM types + content (de)serialization

Vendor-neutral types the engine speaks. No provider may leak its SDK shapes past this module.

**Files:**
- Create: `server/agent/llm/types.py`
- Test: `server/agent/tests/test_llm_types.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_llm_types.py`:

```python
from django.test import SimpleTestCase

from agent.llm.types import (
    ContentBlock,
    LLMMessage,
    Role,
    TextBlock,
    ToolCallBlock,
    ToolResultBlock,
    content_blocks_to_json,
    json_to_content_blocks,
)


class ContentSerializationTests(SimpleTestCase):
    def test_round_trips_all_block_types(self):
        blocks: list[ContentBlock] = [
            TextBlock(text="hello"),
            ToolCallBlock(id="tc_1", name="add_resource", input={"service_id": "lambda"}),
            ToolResultBlock(tool_call_id="tc_1", content="ok", is_error=False),
        ]

        restored = json_to_content_blocks(content_blocks_to_json(blocks))

        self.assertEqual(restored, blocks)

    def test_message_holds_role_and_blocks(self):
        message = LLMMessage(role=Role.USER, content=[TextBlock(text="hi")])

        self.assertEqual(message.role, Role.USER)
        self.assertEqual(message.content[0].text, "hi")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_llm_types -v 2`
Expected: FAIL with `ModuleNotFoundError: No module named 'agent.llm.types'`

- [ ] **Step 3: Write minimal implementation**

`server/agent/llm/types.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Literal, Union


class Role(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass
class TextBlock:
    text: str
    type: Literal["text"] = "text"


@dataclass
class ToolCallBlock:
    id: str
    name: str
    input: dict[str, Any]
    type: Literal["tool_call"] = "tool_call"


@dataclass
class ToolResultBlock:
    tool_call_id: str
    content: str
    is_error: bool = False
    type: Literal["tool_result"] = "tool_result"


ContentBlock = Union[TextBlock, ToolCallBlock, ToolResultBlock]


@dataclass
class LLMMessage:
    role: Role
    content: list[ContentBlock]


@dataclass
class ToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass
class LLMCapabilities:
    supports_streaming: bool = True
    supports_tools: bool = True
    max_context_tokens: int = 200000


# --- Streaming events -------------------------------------------------------


@dataclass
class TextDelta:
    text: str
    type: Literal["text_delta"] = "text_delta"


@dataclass
class ToolCallRequested:
    id: str
    name: str
    input: dict[str, Any]
    type: Literal["tool_call"] = "tool_call"


@dataclass
class Usage:
    input_tokens: int
    output_tokens: int
    type: Literal["usage"] = "usage"


@dataclass
class Stop:
    reason: str
    type: Literal["stop"] = "stop"


LLMEvent = Union[TextDelta, ToolCallRequested, Usage, Stop]


# --- Content (de)serialization for persistence ------------------------------


def content_blocks_to_json(blocks: list[ContentBlock]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for block in blocks:
        if isinstance(block, TextBlock):
            result.append({"type": "text", "text": block.text})
        elif isinstance(block, ToolCallBlock):
            result.append(
                {"type": "tool_call", "id": block.id, "name": block.name, "input": block.input}
            )
        elif isinstance(block, ToolResultBlock):
            result.append(
                {
                    "type": "tool_result",
                    "tool_call_id": block.tool_call_id,
                    "content": block.content,
                    "is_error": block.is_error,
                }
            )
        else:  # pragma: no cover - defensive
            raise TypeError(f"Unknown content block: {block!r}")
    return result


def json_to_content_blocks(data: list[dict[str, Any]]) -> list[ContentBlock]:
    blocks: list[ContentBlock] = []
    for item in data:
        block_type = item.get("type")
        if block_type == "text":
            blocks.append(TextBlock(text=item["text"]))
        elif block_type == "tool_call":
            blocks.append(ToolCallBlock(id=item["id"], name=item["name"], input=item["input"]))
        elif block_type == "tool_result":
            blocks.append(
                ToolResultBlock(
                    tool_call_id=item["tool_call_id"],
                    content=item["content"],
                    is_error=item.get("is_error", False),
                )
            )
        else:  # pragma: no cover - defensive
            raise ValueError(f"Unknown content block type: {block_type!r}")
    return blocks
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_llm_types -v 2`
Expected: PASS (2 tests OK)

- [ ] **Step 5: Commit**

```bash
git add server/agent/llm/types.py server/agent/tests/test_llm_types.py
git commit -m "feat(agent): add canonical LLM types and content serialization"
```

---

## Task 3: Provider interface + registry

**Files:**
- Create: `server/agent/llm/base.py`
- Create: `server/agent/llm/registry.py`
- Test: `server/agent/tests/test_registry.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_registry.py`:

```python
from collections.abc import Iterator

from django.test import SimpleTestCase, override_settings

from agent.llm.base import BaseLLMProvider
from agent.llm.registry import LLMProviderRegistry, get_active_provider, llm_registry
from agent.llm.types import LLMCapabilities, LLMEvent, LLMMessage, Stop, ToolSpec


class _StubProvider(BaseLLMProvider):
    name = "stub"
    capabilities = LLMCapabilities()

    def stream(self, *, system_prompt, messages, tools, temperature=0.0, max_tokens=4096) -> Iterator[LLMEvent]:
        yield Stop(reason="end_turn")


class RegistryTests(SimpleTestCase):
    def test_register_and_get(self):
        registry = LLMProviderRegistry()
        provider = _StubProvider()

        registry.register(provider)

        self.assertIs(registry.get("stub"), provider)

    def test_get_unknown_raises(self):
        registry = LLMProviderRegistry()

        with self.assertRaises(ValueError):
            registry.get("missing")

    @override_settings(AGENT_LLM_PROVIDER="stub")
    def test_get_active_provider_reads_settings(self):
        llm_registry.register(_StubProvider())

        self.assertEqual(get_active_provider().name, "stub")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_registry -v 2`
Expected: FAIL with `ModuleNotFoundError: No module named 'agent.llm.base'`

- [ ] **Step 3: Write minimal implementation**

`server/agent/llm/base.py`:

```python
from abc import ABC, abstractmethod
from collections.abc import Iterator

from .types import LLMCapabilities, LLMEvent, LLMMessage, ToolSpec


class BaseLLMProvider(ABC):
    """Vendor-neutral LLM provider. Adapters translate to/from their SDK here
    and nowhere else, so the engine never depends on a specific vendor."""

    name: str
    capabilities: LLMCapabilities

    @abstractmethod
    def stream(
        self,
        *,
        system_prompt: str,
        messages: list[LLMMessage],
        tools: list[ToolSpec],
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ) -> Iterator[LLMEvent]:
        """Yield a stream of canonical LLMEvents for one model turn."""
        raise NotImplementedError
```

`server/agent/llm/registry.py`:

```python
from django.conf import settings

from .base import BaseLLMProvider


class LLMProviderRegistry:
    def __init__(self):
        self._providers: dict[str, BaseLLMProvider] = {}

    def register(self, provider: BaseLLMProvider) -> None:
        self._providers[provider.name] = provider

    def get(self, name: str) -> BaseLLMProvider:
        if name not in self._providers:
            raise ValueError(f"LLM provider '{name}' is not registered.")
        return self._providers[name]


llm_registry = LLMProviderRegistry()


def get_active_provider() -> BaseLLMProvider:
    return llm_registry.get(settings.AGENT_LLM_PROVIDER)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_registry -v 2`
Expected: PASS (3 tests OK)

- [ ] **Step 5: Commit**

```bash
git add server/agent/llm/base.py server/agent/llm/registry.py server/agent/tests/test_registry.py
git commit -m "feat(agent): add LLM provider interface and registry"
```

---

## Task 4: Anthropic request mappers (pure functions)

Translate canonical tools/messages into the Anthropic request shape. Pure and network-free, so fully unit-testable.

**Files:**
- Create: `server/agent/llm/mappers.py`
- Test: `server/agent/tests/test_mappers.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_mappers.py`:

```python
from django.test import SimpleTestCase

from agent.llm.mappers import to_anthropic_messages, to_anthropic_tools
from agent.llm.types import (
    LLMMessage,
    Role,
    TextBlock,
    ToolCallBlock,
    ToolResultBlock,
    ToolSpec,
)


class MapperTests(SimpleTestCase):
    def test_tools_mapped_to_anthropic_shape(self):
        tools = [ToolSpec(name="add_resource", description="Add a node", input_schema={"type": "object"})]

        result = to_anthropic_tools(tools)

        self.assertEqual(
            result,
            [{"name": "add_resource", "description": "Add a node", "input_schema": {"type": "object"}}],
        )

    def test_assistant_tool_call_maps_to_tool_use(self):
        messages = [
            LLMMessage(role=Role.ASSISTANT, content=[ToolCallBlock(id="tc_1", name="add_resource", input={"x": 1})])
        ]

        result = to_anthropic_messages(messages)

        self.assertEqual(result[0]["role"], "assistant")
        self.assertEqual(result[0]["content"][0]["type"], "tool_use")
        self.assertEqual(result[0]["content"][0]["id"], "tc_1")

    def test_tool_role_maps_to_user_with_tool_result(self):
        messages = [
            LLMMessage(role=Role.TOOL, content=[ToolResultBlock(tool_call_id="tc_1", content="done")])
        ]

        result = to_anthropic_messages(messages)

        self.assertEqual(result[0]["role"], "user")
        self.assertEqual(result[0]["content"][0]["type"], "tool_result")
        self.assertEqual(result[0]["content"][0]["tool_use_id"], "tc_1")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_mappers -v 2`
Expected: FAIL with `ModuleNotFoundError: No module named 'agent.llm.mappers'`

- [ ] **Step 3: Write minimal implementation**

`server/agent/llm/mappers.py`:

```python
from typing import Any

from .types import (
    LLMMessage,
    Role,
    TextBlock,
    ToolCallBlock,
    ToolResultBlock,
    ToolSpec,
)


def to_anthropic_tools(tools: list[ToolSpec]) -> list[dict[str, Any]]:
    return [
        {"name": tool.name, "description": tool.description, "input_schema": tool.input_schema}
        for tool in tools
    ]


def to_anthropic_messages(messages: list[LLMMessage]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for message in messages:
        content: list[dict[str, Any]] = []
        for block in message.content:
            if isinstance(block, TextBlock):
                content.append({"type": "text", "text": block.text})
            elif isinstance(block, ToolCallBlock):
                content.append(
                    {"type": "tool_use", "id": block.id, "name": block.name, "input": block.input}
                )
            elif isinstance(block, ToolResultBlock):
                content.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.tool_call_id,
                        "content": block.content,
                        "is_error": block.is_error,
                    }
                )
        # Anthropic only accepts "user"/"assistant"; tool results ride in a user turn.
        role = "assistant" if message.role == Role.ASSISTANT else "user"
        result.append({"role": role, "content": content})
    return result
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_mappers -v 2`
Expected: PASS (3 tests OK)

- [ ] **Step 5: Commit**

```bash
git add server/agent/llm/mappers.py server/agent/tests/test_mappers.py
git commit -m "feat(agent): add Anthropic request mappers"
```

---

## Task 5: Anthropic provider adapter

Wraps the Anthropic SDK behind `BaseLLMProvider`. The SDK client is injectable so tests run without network.

**Files:**
- Create: `server/agent/llm/anthropic_provider.py`
- Test: `server/agent/tests/test_anthropic_provider.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_anthropic_provider.py`:

```python
from django.test import SimpleTestCase

from agent.llm.anthropic_provider import AnthropicProvider
from agent.llm.types import (
    LLMMessage,
    Role,
    Stop,
    TextBlock,
    TextDelta,
    ToolCallRequested,
    ToolSpec,
    Usage,
)


class _FakeBlock:
    def __init__(self, type, id=None, name=None, input=None):
        self.type = type
        self.id = id
        self.name = name
        self.input = input or {}


class _FakeUsage:
    input_tokens = 11
    output_tokens = 7


class _FakeFinalMessage:
    stop_reason = "tool_use"
    usage = _FakeUsage()
    content = [_FakeBlock(type="tool_use", id="tc_1", name="add_resource", input={"service_id": "lambda"})]


class _FakeStreamContext:
    text_stream = ["Adding ", "a Lambda"]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def get_final_message(self):
        return _FakeFinalMessage()


class _FakeMessages:
    def stream(self, **kwargs):
        return _FakeStreamContext()


class _FakeClient:
    messages = _FakeMessages()


class AnthropicProviderTests(SimpleTestCase):
    def test_name_and_capabilities(self):
        provider = AnthropicProvider(client=_FakeClient(), model="claude-opus-4-8")

        self.assertEqual(provider.name, "anthropic")
        self.assertTrue(provider.capabilities.supports_tools)

    def test_stream_yields_canonical_events(self):
        provider = AnthropicProvider(client=_FakeClient(), model="claude-opus-4-8")

        events = list(
            provider.stream(
                system_prompt="sys",
                messages=[LLMMessage(role=Role.USER, content=[TextBlock(text="hi")])],
                tools=[ToolSpec(name="add_resource", description="d", input_schema={"type": "object"})],
            )
        )

        self.assertEqual(events[0], TextDelta(text="Adding "))
        self.assertEqual(events[1], TextDelta(text="a Lambda"))
        self.assertIn(ToolCallRequested(id="tc_1", name="add_resource", input={"service_id": "lambda"}), events)
        self.assertIn(Usage(input_tokens=11, output_tokens=7), events)
        self.assertIn(Stop(reason="tool_use"), events)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_anthropic_provider -v 2`
Expected: FAIL with `ModuleNotFoundError: No module named 'agent.llm.anthropic_provider'`

- [ ] **Step 3: Write minimal implementation**

`server/agent/llm/anthropic_provider.py`:

```python
from collections.abc import Iterator

from django.conf import settings

from .base import BaseLLMProvider
from .mappers import to_anthropic_messages, to_anthropic_tools
from .types import (
    LLMCapabilities,
    LLMEvent,
    LLMMessage,
    Stop,
    TextDelta,
    ToolCallRequested,
    ToolSpec,
    Usage,
)


class AnthropicProvider(BaseLLMProvider):
    name = "anthropic"
    capabilities = LLMCapabilities(supports_streaming=True, supports_tools=True, max_context_tokens=200000)

    def __init__(self, client=None, model: str | None = None):
        # Client/model resolved lazily so registration never requires an API key.
        self._client = client
        self._model = model

    def _get_client(self):
        if self._client is None:
            import anthropic

            self._client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        return self._client

    def _get_model(self) -> str:
        return self._model or settings.AGENT_LLM_MODEL

    def stream(
        self,
        *,
        system_prompt: str,
        messages: list[LLMMessage],
        tools: list[ToolSpec],
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ) -> Iterator[LLMEvent]:
        client = self._get_client()
        with client.messages.stream(
            model=self._get_model(),
            system=system_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            tools=to_anthropic_tools(tools),
            messages=to_anthropic_messages(messages),
        ) as stream:
            for text in stream.text_stream:
                yield TextDelta(text=text)
            final = stream.get_final_message()

        for block in final.content:
            if block.type == "tool_use":
                yield ToolCallRequested(id=block.id, name=block.name, input=dict(block.input))
        yield Usage(
            input_tokens=final.usage.input_tokens,
            output_tokens=final.usage.output_tokens,
        )
        yield Stop(reason=final.stop_reason)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_anthropic_provider -v 2`
Expected: PASS (2 tests OK)

- [ ] **Step 5: Verify app boot now that `apps.ready()` can import the provider**

Run: `docker compose build server && docker compose run --rm server python manage.py check`
Expected: `System check identified no issues (0 silenced).`
(If you commented out `apps.ready()` body in Task 1 Step 4, restore it now.)

- [ ] **Step 6: Commit**

```bash
git add server/agent/llm/anthropic_provider.py server/agent/tests/test_anthropic_provider.py
git commit -m "feat(agent): add Anthropic provider adapter"
```

---

## Task 6: Constants (enums + event types)

**Files:**
- Create: `server/agent/constants.py`
- Test: `server/agent/tests/test_models.py` (the enum assertions live with the model tests, written in Task 7)

- [ ] **Step 1: Write the implementation**

`server/agent/constants.py`:

```python
from enum import Enum


class ConversationStatus(Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class MessageRole(Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class RunStatus(Enum):
    RUNNING = "running"
    AWAITING_CLIENT = "awaiting_client"
    COMPLETED = "completed"
    FAILED = "failed"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class RiskLevel(Enum):
    SAFE = "safe"
    CONFIRM = "confirm"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


# Realtime event types (Plan B maps these onto send_agent_event).
AGENT_MESSAGE_DELTA = "agent.message.delta"
AGENT_TOOL_CALL = "agent.tool_call"
AGENT_OP_APPLIED = "agent.op_applied"
AGENT_RUN_COMPLETED = "agent.run.completed"
AGENT_RUN_FAILED = "agent.run.failed"
```

- [ ] **Step 2: Commit**

```bash
git add server/agent/constants.py
git commit -m "feat(agent): add agent constants and event types"
```

---

## Task 7: Data models + migration

**Files:**
- Create: `server/agent/models.py`
- Create: `server/agent/migrations/__init__.py` (empty)
- Test: `server/agent/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_models.py`:

```python
from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project

from accounts.models import User
from agent.constants import MessageRole, RunStatus
from agent.models import AgentConversation, AgentMessage, AgentRun


class AgentModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(organisation=self.org, name="P")
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user
        )

    def test_conversation_defaults_active(self):
        self.assertEqual(self.conversation.status, "active")

    def test_message_belongs_to_conversation_and_orders_by_created(self):
        first = AgentMessage.objects.create(
            conversation=self.conversation, role=MessageRole.USER.value, content=[]
        )
        second = AgentMessage.objects.create(
            conversation=self.conversation, role=MessageRole.ASSISTANT.value, content=[]
        )

        self.assertEqual(list(self.conversation.messages.all()), [first, second])

    def test_run_defaults_running_and_zero_counters(self):
        run = AgentRun.objects.create(conversation=self.conversation)

        self.assertEqual(run.status, RunStatus.RUNNING.value)
        self.assertEqual(run.turn_count, 0)
        self.assertEqual(run.input_tokens, 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_models -v 2`
Expected: FAIL with `ModuleNotFoundError: No module named 'agent.models'`

- [ ] **Step 3: Write minimal implementation**

`server/agent/models.py`:

```python
from django.conf import settings
from django.db import models
from orqestra.models import BaseModel

from .constants import ConversationStatus, MessageRole, RunStatus


class AgentConversation(BaseModel):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="agent_conversations"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="agent_conversations",
    )
    title = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(
        max_length=12,
        choices=ConversationStatus.choices(),
        default=ConversationStatus.ACTIVE.value,
    )

    class Meta(BaseModel.Meta):
        db_table = "agent_conversations"

    def __str__(self):
        return f"Conversation {self.id} on {self.project_id}"


class AgentMessage(BaseModel):
    conversation = models.ForeignKey(
        AgentConversation, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=10, choices=MessageRole.choices())
    # Serialized list of content blocks (see agent.llm.types.content_blocks_to_json).
    content = models.JSONField(default=list)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)

    class Meta(BaseModel.Meta):
        db_table = "agent_messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role} message {self.id}"


class AgentRun(BaseModel):
    conversation = models.ForeignKey(
        AgentConversation, on_delete=models.CASCADE, related_name="runs"
    )
    status = models.CharField(
        max_length=16, choices=RunStatus.choices(), default=RunStatus.RUNNING.value
    )
    turn_count = models.PositiveIntegerField(default=0)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True, default="")

    class Meta(BaseModel.Meta):
        db_table = "agent_runs"

    def __str__(self):
        return f"Run {self.id} ({self.status})"
```

Create empty `server/agent/migrations/__init__.py`.

- [ ] **Step 4: Generate the migration**

Run: `docker compose run --rm server python manage.py makemigrations agent`
Expected: creates `server/agent/migrations/0001_initial.py` listing `AgentConversation`, `AgentMessage`, `AgentRun`.

- [ ] **Step 5: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_models -v 2`
Expected: PASS (3 tests OK)

- [ ] **Step 6: Commit**

```bash
git add server/agent/models.py server/agent/migrations/__init__.py server/agent/migrations/0001_initial.py server/agent/tests/test_models.py
git commit -m "feat(agent): add conversation, message, and run models"
```

---

## Task 8: Graph-op tool schema

The agent's action space, expressed as vendor-neutral `ToolSpec`s. The model selects services and wires them; it never emits IaC.

**Files:**
- Create: `server/agent/tools.py`
- Test: `server/agent/tests/test_tools.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_tools.py`:

```python
from django.test import SimpleTestCase

from agent.llm.types import ToolSpec
from agent.tools import GRAPH_OP_NAMES, graph_tool_specs


class ToolSpecTests(SimpleTestCase):
    def test_returns_toolspecs_with_unique_names(self):
        specs = graph_tool_specs()

        self.assertTrue(all(isinstance(spec, ToolSpec) for spec in specs))
        names = [spec.name for spec in specs]
        self.assertEqual(len(names), len(set(names)))

    def test_covers_the_expected_operations(self):
        names = {spec.name for spec in graph_tool_specs()}

        self.assertEqual(names, set(GRAPH_OP_NAMES))

    def test_each_schema_is_a_json_object(self):
        for spec in graph_tool_specs():
            self.assertEqual(spec.input_schema.get("type"), "object")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_tools -v 2`
Expected: FAIL with `ModuleNotFoundError: No module named 'agent.tools'`

- [ ] **Step 3: Write minimal implementation**

`server/agent/tools.py`:

```python
from .llm.types import ToolSpec

GRAPH_OP_NAMES = [
    "list_services",
    "get_service",
    "query_graph",
    "add_resource",
    "connect",
    "configure",
    "set_parent",
    "remove",
    "validate",
    "estimate_cost",
]


def graph_tool_specs() -> list[ToolSpec]:
    return [
        ToolSpec(
            name="list_services",
            description=(
                "List available cloud services from the catalog, optionally filtered "
                "by category. Use this to discover what resources you can add."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Optional category filter, e.g. 'compute', 'storage'.",
                    }
                },
            },
        ),
        ToolSpec(
            name="get_service",
            description="Get the full definition for one service, including its capabilities and allowed relationships.",
            input_schema={
                "type": "object",
                "properties": {"service_id": {"type": "string"}},
                "required": ["service_id"],
            },
        ),
        ToolSpec(
            name="query_graph",
            description="Return the current graph: every node (id, service, label) and edge.",
            input_schema={"type": "object", "properties": {}},
        ),
        ToolSpec(
            name="add_resource",
            description="Add a cloud resource node to the canvas.",
            input_schema={
                "type": "object",
                "properties": {
                    "service_id": {"type": "string", "description": "Registry service id, e.g. 'lambda'."},
                    "label": {"type": "string", "description": "Human-readable node label."},
                    "config": {"type": "object", "description": "Resource configuration values."},
                    "parent_id": {
                        "type": ["string", "null"],
                        "description": "Container node id this resource nests inside, if any.",
                    },
                },
                "required": ["service_id"],
            },
        ),
        ToolSpec(
            name="connect",
            description="Create a typed relationship edge between two nodes.",
            input_schema={
                "type": "object",
                "properties": {
                    "source_id": {"type": "string"},
                    "target_id": {"type": "string"},
                    "relationship_kind": {
                        "type": "string",
                        "description": "e.g. 'invokes', 'reads-from', 'assumes-role'.",
                    },
                },
                "required": ["source_id", "target_id", "relationship_kind"],
            },
        ),
        ToolSpec(
            name="configure",
            description="Patch the configuration of an existing node.",
            input_schema={
                "type": "object",
                "properties": {
                    "node_id": {"type": "string"},
                    "config_patch": {"type": "object"},
                },
                "required": ["node_id", "config_patch"],
            },
        ),
        ToolSpec(
            name="set_parent",
            description="Move a node into (or out of) a container node.",
            input_schema={
                "type": "object",
                "properties": {
                    "node_id": {"type": "string"},
                    "parent_id": {"type": ["string", "null"]},
                },
                "required": ["node_id"],
            },
        ),
        ToolSpec(
            name="remove",
            description="Delete a node or an edge by id.",
            input_schema={
                "type": "object",
                "properties": {"target_id": {"type": "string"}},
                "required": ["target_id"],
            },
        ),
        ToolSpec(
            name="validate",
            description="Run validation over the whole graph and return any errors.",
            input_schema={"type": "object", "properties": {}},
        ),
        ToolSpec(
            name="estimate_cost",
            description="Return the current estimated monthly cost of the graph.",
            input_schema={"type": "object", "properties": {}},
        ),
    ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_tools -v 2`
Expected: PASS (3 tests OK)

- [ ] **Step 5: Commit**

```bash
git add server/agent/tools.py server/agent/tests/test_tools.py
git commit -m "feat(agent): add graph-op tool schema"
```

---

## Task 9: Coarse risk classifier

Op-type risk only (server-side). Fine-grained cost/security risk is computed client-side at apply time (Slice B / Plan C) — out of scope here.

**Files:**
- Create: `server/agent/risk.py`
- Test: `server/agent/tests/test_risk.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_risk.py`:

```python
from django.test import SimpleTestCase

from agent.constants import RiskLevel
from agent.risk import classify_op_risk


class RiskTests(SimpleTestCase):
    def test_remove_requires_confirmation(self):
        self.assertEqual(classify_op_risk("remove", {"target_id": "n1"}), RiskLevel.CONFIRM)

    def test_add_resource_is_safe(self):
        self.assertEqual(classify_op_risk("add_resource", {"service_id": "lambda"}), RiskLevel.SAFE)

    def test_read_only_ops_are_safe(self):
        self.assertEqual(classify_op_risk("query_graph", {}), RiskLevel.SAFE)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_risk -v 2`
Expected: FAIL with `ModuleNotFoundError: No module named 'agent.risk'`

- [ ] **Step 3: Write minimal implementation**

`server/agent/risk.py`:

```python
from .constants import RiskLevel

# Operations whose blast radius always warrants a human confirm, regardless of
# the specific resource. Fine-grained cost/security risk is layered on the
# client at apply time.
CONFIRM_OPS = {"remove"}


def classify_op_risk(op_name: str, op_input: dict) -> RiskLevel:
    if op_name in CONFIRM_OPS:
        return RiskLevel.CONFIRM
    return RiskLevel.SAFE
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_risk -v 2`
Expected: PASS (3 tests OK)

- [ ] **Step 5: Commit**

```bash
git add server/agent/risk.py server/agent/tests/test_risk.py
git commit -m "feat(agent): add coarse op-type risk classifier"
```

---

## Task 10: System-prompt assembly

Builds the system prompt from the client-supplied catalog and the project's current graph. The catalog is supplied by the client because the rich service metadata lives only on the frontend registry.

**Files:**
- Create: `server/agent/prompts.py`
- Test: `server/agent/tests/test_prompts.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_prompts.py`:

```python
from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project

from accounts.models import User
from agent.prompts import build_system_prompt


class PromptTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(
            organisation=self.org,
            name="P",
            nodes=[{"id": "n1", "data": {"service_id": "lambda", "label": "API"}}],
            edges=[],
        )
        self.catalog = [
            {"id": "lambda", "name": "AWS Lambda", "category": "compute"},
            {"id": "s3", "name": "Amazon S3", "category": "storage"},
        ]

    def test_prompt_lists_catalog_services(self):
        prompt = build_system_prompt(self.catalog, self.project)

        self.assertIn("AWS Lambda", prompt)
        self.assertIn("s3", prompt)

    def test_prompt_summarizes_current_graph(self):
        prompt = build_system_prompt(self.catalog, self.project)

        self.assertIn("n1", prompt)
        self.assertIn("1 node", prompt)

    def test_prompt_mentions_target_user_and_rules(self):
        prompt = build_system_prompt(self.catalog, self.project)

        self.assertIn("DevOps", prompt)
        self.assertIn("validate", prompt)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_prompts -v 2`
Expected: FAIL with `ModuleNotFoundError: No module named 'agent.prompts'`

- [ ] **Step 3: Write minimal implementation**

`server/agent/prompts.py`:

```python
from projects.models import Project

_SYSTEM_PREAMBLE = """You are Orqestra's infrastructure agent. You design cloud \
architectures on a visual canvas for DevOps engineers who may have limited cloud \
depth: explain your reasoning briefly and own the deep wiring (IAM, networking, \
encryption).

You edit the architecture graph ONLY through the provided tools. You never write \
Terraform or IaC directly. Select services from the catalog and wire them by \
capability and relationship. After making changes, call `validate` and fix any \
errors before finishing. Prefer the smallest correct architecture that meets the \
stated requirements."""


def _format_catalog(catalog: list[dict]) -> str:
    lines = []
    for service in catalog:
        lines.append(
            f"- {service.get('id')}: {service.get('name')} "
            f"[{service.get('category', 'general')}]"
        )
    return "\n".join(lines)


def _format_graph(project: Project) -> str:
    nodes = project.nodes or []
    edges = project.edges or []
    if not nodes:
        return "The canvas is currently empty (0 nodes, 0 edges)."
    node_lines = []
    for node in nodes:
        data = node.get("data", {})
        node_lines.append(
            f"- {node.get('id')}: {data.get('service_id')} ({data.get('label', '')})"
        )
    return (
        f"Current graph: {len(nodes)} node(s), {len(edges)} edge(s).\n"
        + "\n".join(node_lines)
    )


def build_system_prompt(catalog: list[dict], project: Project) -> str:
    return (
        f"{_SYSTEM_PREAMBLE}\n\n"
        f"## Available services\n{_format_catalog(catalog)}\n\n"
        f"## Current canvas\n{_format_graph(project)}"
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_prompts -v 2`
Expected: PASS (3 tests OK)

- [ ] **Step 5: Commit**

```bash
git add server/agent/prompts.py server/agent/tests/test_prompts.py
git commit -m "feat(agent): add system-prompt assembly"
```

---

## Task 11: The engine — `AgentEngine.advance()`

One LLM turn per call. Ingests prior tool results, runs the provider, persists the assistant message, classifies returned ops by risk, emits events through the injected sink, updates run state, and returns the ops.

**Files:**
- Create: `server/agent/engine.py`
- Create: `server/agent/tests/fakes.py`
- Test: `server/agent/tests/test_engine.py`

- [ ] **Step 1: Write the fakes**

`server/agent/tests/fakes.py`:

```python
from collections.abc import Iterator

from agent.llm.base import BaseLLMProvider
from agent.llm.types import LLMCapabilities, LLMEvent


class FakeLLMProvider(BaseLLMProvider):
    """Yields pre-scripted turns. Each turn is a list of LLMEvents."""

    name = "fake"
    capabilities = LLMCapabilities()

    def __init__(self, scripted_turns: list[list[LLMEvent]]):
        self._turns = list(scripted_turns)
        self._index = 0
        self.calls: list[dict] = []

    def stream(self, *, system_prompt, messages, tools, temperature=0.0, max_tokens=4096) -> Iterator[LLMEvent]:
        self.calls.append({"system_prompt": system_prompt, "messages": messages, "tools": tools})
        turn = self._turns[self._index]
        self._index += 1
        yield from turn


class RecordingSink:
    """Captures (event_type, payload) tuples emitted by the engine."""

    def __init__(self):
        self.events: list[tuple[str, dict]] = []

    def __call__(self, event_type: str, payload: dict) -> None:
        self.events.append((event_type, payload))
```

- [ ] **Step 2: Write the failing test**

`server/agent/tests/test_engine.py`:

```python
from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project

from accounts.models import User
from agent.constants import (
    AGENT_RUN_COMPLETED,
    AGENT_TOOL_CALL,
    MessageRole,
    RiskLevel,
    RunStatus,
)
from agent.engine import AgentEngine
from agent.llm.types import Stop, TextDelta, ToolCallRequested, Usage
from agent.models import AgentConversation, AgentMessage, AgentRun
from agent.tests.fakes import FakeLLMProvider, RecordingSink

CATALOG = [{"id": "lambda", "name": "AWS Lambda", "category": "compute"}]


class EngineTestBase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(organisation=self.org, name="P", nodes=[], edges=[])
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user
        )
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.USER.value,
            content=[{"type": "text", "text": "Build me a web API."}],
        )
        self.run = AgentRun.objects.create(conversation=self.conversation)


class AdvanceTests(EngineTestBase):
    def test_tool_turn_returns_ops_and_awaits_client(self):
        provider = FakeLLMProvider([
            [
                TextDelta(text="Adding a Lambda."),
                ToolCallRequested(id="tc_1", name="add_resource", input={"service_id": "lambda"}),
                Usage(input_tokens=10, output_tokens=5),
                Stop(reason="tool_use"),
            ]
        ])
        sink = RecordingSink()
        engine = AgentEngine(provider=provider, event_sink=sink)

        result = engine.advance(self.run, op_results=[], catalog=CATALOG)

        self.assertEqual(result.run_status, RunStatus.AWAITING_CLIENT.value)
        self.assertEqual(len(result.ops), 1)
        self.assertEqual(result.ops[0].name, "add_resource")
        self.assertEqual(result.ops[0].risk, RiskLevel.SAFE.value)
        self.assertEqual(result.assistant_text, "Adding a Lambda.")
        self.assertIn(AGENT_TOOL_CALL, [event_type for event_type, _ in sink.events])

    def test_text_only_turn_completes_run(self):
        provider = FakeLLMProvider([
            [TextDelta(text="All done!"), Usage(input_tokens=3, output_tokens=2), Stop(reason="end_turn")]
        ])
        sink = RecordingSink()
        engine = AgentEngine(provider=provider, event_sink=sink)

        result = engine.advance(self.run, op_results=[], catalog=CATALOG)

        self.assertEqual(result.run_status, RunStatus.COMPLETED.value)
        self.assertEqual(result.ops, [])
        self.run.refresh_from_db()
        self.assertEqual(self.run.status, RunStatus.COMPLETED.value)
        self.assertIn(AGENT_RUN_COMPLETED, [event_type for event_type, _ in sink.events])

    def test_persists_assistant_message_with_tokens(self):
        provider = FakeLLMProvider([
            [TextDelta(text="Hi"), Usage(input_tokens=4, output_tokens=1), Stop(reason="end_turn")]
        ])
        engine = AgentEngine(provider=provider)

        engine.advance(self.run, op_results=[], catalog=CATALOG)

        assistant = self.conversation.messages.filter(role=MessageRole.ASSISTANT.value).first()
        self.assertIsNotNone(assistant)
        self.assertEqual(assistant.content[0]["text"], "Hi")
        self.assertEqual(assistant.output_tokens, 1)

    def test_op_results_persisted_as_tool_message(self):
        provider = FakeLLMProvider([
            [TextDelta(text="Done"), Usage(input_tokens=1, output_tokens=1), Stop(reason="end_turn")]
        ])
        engine = AgentEngine(provider=provider)

        engine.advance(
            self.run,
            op_results=[{"tool_call_id": "tc_1", "content": "added node n1", "is_error": False}],
            catalog=CATALOG,
        )

        tool_message = self.conversation.messages.filter(role=MessageRole.TOOL.value).first()
        self.assertIsNotNone(tool_message)
        self.assertEqual(tool_message.content[0]["tool_call_id"], "tc_1")

    def test_max_turns_guard_fails_run(self):
        provider = FakeLLMProvider([])  # never called
        engine = AgentEngine(provider=provider, max_turns=2)
        self.run.turn_count = 2
        self.run.save(update_fields=["turn_count"])

        result = engine.advance(self.run, op_results=[], catalog=CATALOG)

        self.assertEqual(result.run_status, RunStatus.FAILED.value)
        self.run.refresh_from_db()
        self.assertEqual(self.run.status, RunStatus.FAILED.value)
        self.assertTrue(self.run.error)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_engine -v 2`
Expected: FAIL with `ModuleNotFoundError: No module named 'agent.engine'`

- [ ] **Step 4: Write minimal implementation**

`server/agent/engine.py`:

```python
from collections.abc import Callable
from dataclasses import dataclass, field

from django.conf import settings

from .constants import (
    AGENT_MESSAGE_DELTA,
    AGENT_OP_APPLIED,
    AGENT_RUN_COMPLETED,
    AGENT_RUN_FAILED,
    AGENT_TOOL_CALL,
    MessageRole,
    RunStatus,
)
from .llm.base import BaseLLMProvider
from .llm.types import (
    LLMMessage,
    Role,
    TextBlock,
    TextDelta,
    ToolCallBlock,
    ToolCallRequested,
    ToolResultBlock,
    Usage,
    content_blocks_to_json,
    json_to_content_blocks,
)
from .models import AgentMessage, AgentRun
from .prompts import build_system_prompt
from .risk import classify_op_risk
from .tools import graph_tool_specs

EventSink = Callable[[str, dict], None]


def _noop_sink(event_type: str, payload: dict) -> None:
    pass


_ROLE_TO_CANONICAL = {
    MessageRole.USER.value: Role.USER,
    MessageRole.ASSISTANT.value: Role.ASSISTANT,
    MessageRole.TOOL.value: Role.TOOL,
}


@dataclass
class OpRequest:
    tool_call_id: str
    name: str
    input: dict
    risk: str


@dataclass
class AdvanceResult:
    ops: list[OpRequest] = field(default_factory=list)
    assistant_text: str = ""
    run_status: str = RunStatus.RUNNING.value


class AgentEngine:
    def __init__(
        self,
        provider: BaseLLMProvider,
        event_sink: EventSink | None = None,
        max_turns: int | None = None,
    ):
        self.provider = provider
        self.emit = event_sink or _noop_sink
        self.max_turns = max_turns if max_turns is not None else settings.AGENT_MAX_TURNS

    def advance(self, run: AgentRun, op_results: list[dict], catalog: list[dict]) -> AdvanceResult:
        if run.turn_count >= self.max_turns:
            return self._fail(run, f"Exceeded max turns ({self.max_turns}).")

        conversation = run.conversation

        # 1. Ingest the previous turn's tool results as a TOOL message.
        if op_results:
            tool_blocks = [
                ToolResultBlock(
                    tool_call_id=item["tool_call_id"],
                    content=item.get("content", ""),
                    is_error=item.get("is_error", False),
                )
                for item in op_results
            ]
            AgentMessage.objects.create(
                conversation=conversation,
                role=MessageRole.TOOL.value,
                content=content_blocks_to_json(tool_blocks),
            )
            for item in op_results:
                self.emit(AGENT_OP_APPLIED, {"run_id": str(run.id), "tool_call_id": item["tool_call_id"]})

        # 2. Rebuild the canonical message history.
        history = self._load_history(conversation)
        system_prompt = build_system_prompt(catalog, conversation.project)

        # 3. Run one model turn, accumulating text + tool calls.
        text_parts: list[str] = []
        tool_calls: list[ToolCallRequested] = []
        input_tokens = output_tokens = 0

        try:
            for event in self.provider.stream(
                system_prompt=system_prompt, messages=history, tools=graph_tool_specs()
            ):
                if isinstance(event, TextDelta):
                    text_parts.append(event.text)
                    self.emit(AGENT_MESSAGE_DELTA, {"run_id": str(run.id), "text": event.text})
                elif isinstance(event, ToolCallRequested):
                    tool_calls.append(event)
                elif isinstance(event, Usage):
                    input_tokens = event.input_tokens
                    output_tokens = event.output_tokens
        except Exception as error:  # noqa: BLE001 - surface provider failures as a failed run
            return self._fail(run, f"LLM provider error: {error}")

        assistant_text = "".join(text_parts)

        # 4. Persist the assistant message.
        blocks = []
        if assistant_text:
            blocks.append(TextBlock(text=assistant_text))
        for call in tool_calls:
            blocks.append(ToolCallBlock(id=call.id, name=call.name, input=call.input))
        AgentMessage.objects.create(
            conversation=conversation,
            role=MessageRole.ASSISTANT.value,
            content=content_blocks_to_json(blocks),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

        # 5. Update run accounting.
        run.turn_count += 1
        run.input_tokens += input_tokens
        run.output_tokens += output_tokens

        # 6. Classify ops and decide next state.
        if tool_calls:
            ops = [
                OpRequest(
                    tool_call_id=call.id,
                    name=call.name,
                    input=call.input,
                    risk=classify_op_risk(call.name, call.input).value,
                )
                for call in tool_calls
            ]
            for op in ops:
                self.emit(
                    AGENT_TOOL_CALL,
                    {
                        "run_id": str(run.id),
                        "tool_call_id": op.tool_call_id,
                        "name": op.name,
                        "input": op.input,
                        "risk": op.risk,
                    },
                )
            run.status = RunStatus.AWAITING_CLIENT.value
            run.save(update_fields=["status", "turn_count", "input_tokens", "output_tokens", "updated_at"])
            return AdvanceResult(ops=ops, assistant_text=assistant_text, run_status=run.status)

        run.status = RunStatus.COMPLETED.value
        run.save(update_fields=["status", "turn_count", "input_tokens", "output_tokens", "updated_at"])
        self.emit(AGENT_RUN_COMPLETED, {"run_id": str(run.id), "input_tokens": run.input_tokens, "output_tokens": run.output_tokens})
        return AdvanceResult(ops=[], assistant_text=assistant_text, run_status=run.status)

    def _load_history(self, conversation) -> list[LLMMessage]:
        history: list[LLMMessage] = []
        for message in conversation.messages.all():
            history.append(
                LLMMessage(
                    role=_ROLE_TO_CANONICAL[message.role],
                    content=json_to_content_blocks(message.content),
                )
            )
        return history

    def _fail(self, run: AgentRun, error: str) -> AdvanceResult:
        run.status = RunStatus.FAILED.value
        run.error = error
        run.save(update_fields=["status", "error", "updated_at"])
        self.emit(AGENT_RUN_FAILED, {"run_id": str(run.id), "error": error})
        return AdvanceResult(ops=[], assistant_text="", run_status=run.status)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_engine -v 2`
Expected: PASS (5 tests OK)

- [ ] **Step 6: Commit**

```bash
git add server/agent/engine.py server/agent/tests/fakes.py server/agent/tests/test_engine.py
git commit -m "feat(agent): add the turn-by-turn agent engine"
```

---

## Task 12: Integration test — a full scripted build loop

Proves the client-driven loop end to end: turn 1 emits an op; the (simulated) client reports the result; turn 2 finishes the run.

**Files:**
- Test: `server/agent/tests/test_integration.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_integration.py`:

```python
from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project

from accounts.models import User
from agent.constants import MessageRole, RunStatus
from agent.engine import AgentEngine
from agent.llm.types import Stop, TextDelta, ToolCallRequested, Usage
from agent.models import AgentConversation, AgentMessage, AgentRun
from agent.tests.fakes import FakeLLMProvider, RecordingSink

CATALOG = [{"id": "lambda", "name": "AWS Lambda", "category": "compute"}]


class IntegrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(organisation=self.org, name="P", nodes=[], edges=[])
        self.conversation = AgentConversation.objects.create(project=self.project, created_by=self.user)
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.USER.value,
            content=[{"type": "text", "text": "Add a lambda."}],
        )
        self.run = AgentRun.objects.create(conversation=self.conversation)

    def test_two_turn_loop_builds_and_completes(self):
        provider = FakeLLMProvider([
            # Turn 1: ask to add a Lambda.
            [
                TextDelta(text="Adding a Lambda."),
                ToolCallRequested(id="tc_1", name="add_resource", input={"service_id": "lambda"}),
                Usage(input_tokens=20, output_tokens=8),
                Stop(reason="tool_use"),
            ],
            # Turn 2: after the client reports success, finish.
            [
                TextDelta(text="Your Lambda is ready."),
                Usage(input_tokens=25, output_tokens=6),
                Stop(reason="end_turn"),
            ],
        ])
        sink = RecordingSink()
        engine = AgentEngine(provider=provider, event_sink=sink)

        first = engine.advance(self.run, op_results=[], catalog=CATALOG)
        self.assertEqual(first.run_status, RunStatus.AWAITING_CLIENT.value)
        self.assertEqual(first.ops[0].name, "add_resource")

        # Simulate the client applying the op and reporting back.
        second = engine.advance(
            self.run,
            op_results=[{"tool_call_id": "tc_1", "content": "node n1 added; validate: ok", "is_error": False}],
            catalog=CATALOG,
        )

        self.assertEqual(second.run_status, RunStatus.COMPLETED.value)
        self.run.refresh_from_db()
        self.assertEqual(self.run.turn_count, 2)
        self.assertEqual(self.run.input_tokens, 45)
        # user + assistant(turn1) + tool + assistant(turn2)
        self.assertEqual(self.conversation.messages.count(), 4)
```

- [ ] **Step 2: Run test to verify it fails, then passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_integration -v 2`
Expected: PASS (1 test OK) — all dependencies already exist from Tasks 2–11. If it fails, fix the engine, not the test.

- [ ] **Step 3: Run the full agent suite**

Run: `docker compose run --rm server python manage.py test agent -v 2`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add server/agent/tests/test_integration.py
git commit -m "test(agent): add end-to-end engine loop integration test"
```

---

## Done criteria for Plan A

- [ ] `docker compose run --rm server python manage.py check` passes.
- [ ] `docker compose run --rm server python manage.py test agent` passes.
- [ ] The engine runs a multi-turn loop with a fake provider, persists conversation/messages/run, classifies op risk, and emits lifecycle events through an injected sink — with zero HTTP/WebSocket coupling.

## Hand-off to Plan B (REST API + Channels streaming)

Plan B will: add `send_agent_event(project_id, event_type, payload)` to `server/realtime/events.py` (group `project_{id}`, prefix already `agent.`); add serializers + a viewset exposing **create conversation** (with first user message + catalog), **advance** (accepts `op_results`, returns ops), and **retrieve conversation/messages**; inject `send_agent_event` (bound to the project id) as the engine's `event_sink`; and enforce `CanWriteOrganisation`. Plan C wires the frontend op-executor + agent panel.
```
