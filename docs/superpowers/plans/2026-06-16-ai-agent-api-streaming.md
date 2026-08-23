# AI Agent — REST API & Streaming Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the Plan A agent engine over HTTP and wire its lifecycle events onto the existing WebSocket layer, so a client can create a conversation, drive the turn-by-turn build loop, and receive streamed agent events.

**Architecture:** A thin DRF surface over the engine. `AgentConversationViewSet` creates/lists/retrieves conversations and exposes a `send` action (add user message → create run → run one engine turn). `AgentRunViewSet` exposes an `advance` action (ingest the client's op results → run the next turn). Both build an `AgentEngine` whose `event_sink` is bound to `send_agent_event(project_id, ...)`, which broadcasts to the already-supported `project_{id}` Channels group. The catalog is supplied by the client once at conversation creation and stored on the conversation.

**Tech Stack:** Django/DRF, Django Channels (existing `realtime` app), Postgres. Builds directly on Plan A (`server/agent/`).

**Depends on:** Plan A complete (engine, models, `get_active_provider`, `FakeLLMProvider`, agent event constants all exist).

**Scope boundaries:**
- IN: `send_agent_event` helper; `catalog` field on `AgentConversation`; `organisation` property on `AgentRun`; serializers; `AgentConversationViewSet` (create/list/retrieve/send); `AgentRunViewSet` (advance); URL wiring; permission + org-scoping; tests via patched provider.
- OUT (later): all frontend work (Plan C); annotation-tagging surface + fine-grained risk (Slice B); token-by-token WS streaming is emitted as `agent.message.delta` events by the Plan A engine already — this plan only routes them through `send_agent_event`.

**Conventions:** backend ops via `docker compose run --rm server python manage.py ...`; mirror the `annotations` viewset/event pattern; response keys stay snake_case (frontend maps to camelCase); no raw exceptions; reuse `BaseTestCase`.

---

## File Structure

```
server/realtime/events.py        # ADD send_agent_event()
server/agent/models.py           # ADD AgentConversation.catalog; AgentRun.organisation property
server/agent/migrations/0002_agentconversation_catalog.py   # generated
server/agent/serializers.py      # NEW: message/conversation serializers + advance_result_to_dict
server/agent/views.py            # NEW: build_engine(); AgentConversationViewSet; AgentRunViewSet
server/agent/urls.py             # NEW: router for conversations + runs
server/orqestra/urls.py          # ADD path("agent/", include("agent.urls"))
server/agent/tests/test_events.py        # NEW
server/agent/tests/test_api_models.py    # NEW (catalog + organisation property)
server/agent/tests/test_serializers.py   # NEW
server/agent/tests/test_api.py           # NEW (viewsets)
server/agent/tests/test_api_integration.py  # NEW (full HTTP loop)
```

---

## Task 1: `send_agent_event` realtime helper

**Files:**
- Modify: `server/realtime/events.py`
- Test: `server/agent/tests/test_events.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_events.py`:

```python
from unittest.mock import patch

from django.test import SimpleTestCase

from realtime.events import send_agent_event


class SendAgentEventTests(SimpleTestCase):
    @patch("realtime.events.emit_event")
    def test_targets_project_group_without_extra_prefix(self, mock_emit):
        send_agent_event("proj-1", "agent.tool_call", {"x": 1})

        mock_emit.assert_called_once_with("project_proj-1", "agent.tool_call", {"x": 1})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_events -v 2`
Expected: FAIL with `ImportError: cannot import name 'send_agent_event'`

- [ ] **Step 3: Write minimal implementation**

Append to `server/realtime/events.py`:

```python
def send_agent_event(project_id, event_type, payload):
    """
    Emits an agent event for a specific project's group.

    Unlike the other helpers, event_type is forwarded as-is: agent event types
    (see agent/constants.py) already carry the 'agent.' prefix.
    """
    group_name = f"project_{project_id}"
    emit_event(group_name, event_type, payload)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_events -v 2`
Expected: PASS (1 test OK)

- [ ] **Step 5: Commit**

```bash
git add server/realtime/events.py server/agent/tests/test_events.py
git commit -m "feat(agent): add send_agent_event realtime helper"
```

---

## Task 2: `catalog` field + `AgentRun.organisation` property

**Files:**
- Modify: `server/agent/models.py`
- Create: `server/agent/migrations/0002_agentconversation_catalog.py` (generated)
- Test: `server/agent/tests/test_api_models.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_api_models.py`:

```python
from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project

from accounts.models import User
from agent.models import AgentConversation, AgentRun


class CatalogAndPropertyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(organisation=self.org, name="P")
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user
        )

    def test_catalog_defaults_to_empty_list(self):
        self.assertEqual(self.conversation.catalog, [])

    def test_catalog_persists_payload(self):
        self.conversation.catalog = [{"id": "lambda", "name": "AWS Lambda"}]
        self.conversation.save(update_fields=["catalog"])
        self.conversation.refresh_from_db()

        self.assertEqual(self.conversation.catalog[0]["id"], "lambda")

    def test_run_organisation_resolves_through_conversation(self):
        run = AgentRun.objects.create(conversation=self.conversation)

        self.assertEqual(run.organisation, self.org)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_api_models -v 2`
Expected: FAIL with `AttributeError` (no `catalog` / no `organisation`).

- [ ] **Step 3: Write minimal implementation**

In `server/agent/models.py`, add the `catalog` field to `AgentConversation` (after `status`):

```python
    # Client-supplied service catalog snapshot (frontend registry projection),
    # used by the engine for prompt + grounding. Stored once at creation.
    catalog = models.JSONField(default=list, blank=True)
```

And add an `organisation` property to `AgentRun` (after `__str__`):

```python
    @property
    def organisation(self):
        return self.conversation.project.organisation
```

- [ ] **Step 4: Generate the migration**

Run: `docker compose run --rm server python manage.py makemigrations agent`
Expected: creates `server/agent/migrations/0002_agentconversation_catalog.py` adding the `catalog` field.

- [ ] **Step 5: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_api_models -v 2`
Expected: PASS (3 tests OK)

- [ ] **Step 6: Commit**

```bash
git add server/agent/models.py server/agent/migrations/0002_agentconversation_catalog.py server/agent/tests/test_api_models.py
git commit -m "feat(agent): store catalog on conversation and expose run.organisation"
```

---

## Task 3: Serializers + advance-result helper

**Files:**
- Create: `server/agent/serializers.py`
- Test: `server/agent/tests/test_serializers.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_serializers.py`:

```python
from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project

from accounts.models import User
from agent.engine import AdvanceResult, OpRequest
from agent.models import AgentConversation, AgentMessage, AgentRun
from agent.serializers import (
    AgentConversationDetailSerializer,
    advance_result_to_dict,
)


class SerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(organisation=self.org, name="P")
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user
        )
        AgentMessage.objects.create(
            conversation=self.conversation,
            role="user",
            content=[{"type": "text", "text": "hi"}],
        )

    def test_detail_serializer_nests_messages(self):
        data = AgentConversationDetailSerializer(self.conversation).data

        self.assertEqual(len(data["messages"]), 1)
        self.assertEqual(data["messages"][0]["role"], "user")
        self.assertEqual(data["messages"][0]["content"][0]["text"], "hi")

    def test_advance_result_to_dict_shape(self):
        run = AgentRun.objects.create(conversation=self.conversation)
        result = AdvanceResult(
            ops=[OpRequest(tool_call_id="tc_1", name="add_resource", input={"service_id": "lambda"}, risk="safe")],
            assistant_text="Adding a Lambda.",
            run_status="awaiting_client",
        )

        payload = advance_result_to_dict(run, result)

        self.assertEqual(payload["run_id"], str(run.id))
        self.assertEqual(payload["status"], "awaiting_client")
        self.assertEqual(payload["assistant_text"], "Adding a Lambda.")
        self.assertEqual(payload["ops"][0]["name"], "add_resource")
        self.assertEqual(payload["ops"][0]["risk"], "safe")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_serializers -v 2`
Expected: FAIL with `ModuleNotFoundError: No module named 'agent.serializers'`

- [ ] **Step 3: Write minimal implementation**

`server/agent/serializers.py`:

```python
from rest_framework import serializers

from .engine import AdvanceResult
from .models import AgentConversation, AgentMessage, AgentRun


class AgentMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentMessage
        fields = ["id", "role", "content", "input_tokens", "output_tokens", "created_at"]
        read_only_fields = fields


class AgentConversationSerializer(serializers.ModelSerializer):
    catalog = serializers.JSONField(required=False, write_only=True)

    class Meta:
        model = AgentConversation
        fields = ["id", "project", "title", "status", "catalog", "created_at", "updated_at"]
        read_only_fields = ["id", "status", "created_at", "updated_at"]


class AgentConversationDetailSerializer(serializers.ModelSerializer):
    messages = AgentMessageSerializer(many=True, read_only=True)

    class Meta:
        model = AgentConversation
        fields = ["id", "project", "title", "status", "messages", "created_at", "updated_at"]
        read_only_fields = fields


def advance_result_to_dict(run: AgentRun, result: AdvanceResult) -> dict:
    return {
        "run_id": str(run.id),
        "status": result.run_status,
        "assistant_text": result.assistant_text,
        "ops": [
            {
                "tool_call_id": op.tool_call_id,
                "name": op.name,
                "input": op.input,
                "risk": op.risk,
            }
            for op in result.ops
        ],
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_serializers -v 2`
Expected: PASS (2 tests OK)

- [ ] **Step 5: Commit**

```bash
git add server/agent/serializers.py server/agent/tests/test_serializers.py
git commit -m "feat(agent): add agent serializers and advance-result helper"
```

---

## Task 4: Conversation viewset (create / list / retrieve) + URL wiring

**Files:**
- Create: `server/agent/views.py`
- Create: `server/agent/urls.py`
- Modify: `server/orqestra/urls.py`
- Test: `server/agent/tests/test_api.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_api.py`:

```python
from django.test import override_settings
from django.urls import reverse
from organisations.models import Organisation
from orqestra.tests import BaseTestCase
from projects.models import Project
from rest_framework import status

from accounts.models import User
from agent.models import AgentConversation


@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class ConversationApiTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation, name="P", nodes=[], edges=[]
        )

    def test_create_conversation_stores_catalog_and_creator(self):
        response = self.client.post(
            reverse("agent-conversation-list"),
            {
                "project": str(self.project.id),
                "catalog": [{"id": "lambda", "name": "AWS Lambda", "category": "compute"}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        conversation = AgentConversation.objects.get()
        self.assertEqual(conversation.catalog[0]["id"], "lambda")
        self.assertEqual(conversation.created_by, self.user)

    def test_create_rejects_project_from_other_org(self):
        other_user = User.objects.create_user(
            email="o@example.com", password="TestPassword123!", name="O"
        )
        other_org = Organisation.objects.create(name="Other", owner=other_user)
        other_project = Project.objects.create(organisation=other_org, name="X")

        response = self.client.post(
            reverse("agent-conversation-list"),
            {"project": str(other_project.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_returns_nested_messages(self):
        conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user
        )

        response = self.client.get(
            reverse("agent-conversation-detail", args=[conversation.id])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("messages", response.data)

    def test_list_scoped_to_active_org(self):
        AgentConversation.objects.create(project=self.project, created_by=self.user)
        other_user = User.objects.create_user(
            email="o@example.com", password="TestPassword123!", name="O"
        )
        other_org = Organisation.objects.create(name="Other", owner=other_user)
        other_project = Project.objects.create(organisation=other_org, name="X")
        AgentConversation.objects.create(project=other_project, created_by=other_user)

        response = self.client.get(reverse("agent-conversation-list"))

        self.assertEqual(len(response.data), 1)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_api -v 2`
Expected: FAIL — `agent.urls` / `agent.views` do not exist (reverse lookup or import error).

- [ ] **Step 3: Write the implementation**

`server/agent/views.py`:

```python
import logging

from organisations.helpers import get_active_organisation, log_action
from organisations.permissions import CanWriteOrganisation, IsOrganisationMember
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from realtime.events import send_agent_event

from .engine import AgentEngine
from .constants import MessageRole
from .llm.registry import get_active_provider
from .llm.types import TextBlock, content_blocks_to_json
from .models import AgentConversation, AgentMessage, AgentRun
from .serializers import (
    AgentConversationDetailSerializer,
    AgentConversationSerializer,
    advance_result_to_dict,
)

logger = logging.getLogger(__name__)


def build_engine(conversation: AgentConversation) -> AgentEngine:
    """Build an engine whose event sink broadcasts to the project's group."""
    project_id = str(conversation.project_id)

    def sink(event_type: str, payload: dict) -> None:
        try:
            send_agent_event(project_id, event_type, payload)
        except Exception as error:  # noqa: BLE001 - never let streaming break a turn
            logger.error(f"Failed to emit agent event {event_type}: {error}")

    return AgentEngine(provider=get_active_provider(), event_sink=sink)


class AgentConversationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    lookup_value_regex = "[0-9a-f-]{36}"

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            self.permission_classes = [IsOrganisationMember]
        else:
            self.permission_classes = [CanWriteOrganisation]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return AgentConversationDetailSerializer
        return AgentConversationSerializer

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        queryset = AgentConversation.objects.filter(
            project__organisation=active_org
        ).select_related("project")
        if self.action == "list":
            project_id = self.request.query_params.get("project")
            if project_id:
                queryset = queryset.filter(project_id=project_id)
        return queryset

    def perform_create(self, serializer):
        active_org = get_active_organisation(self.request)
        project = serializer.validated_data.get("project")
        if project.organisation_id != active_org.id:
            raise ValidationError(
                {"project": "Project must belong to the active organisation."}
            )
        conversation = serializer.save(created_by=self.request.user)
        log_action(
            organisation=active_org,
            actor=self.request.user,
            action="agent.conversation.create",
            details={"conversation_id": str(conversation.id), "project_id": str(project.id)},
        )

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        conversation = self.get_object()
        message_text = (request.data.get("message") or "").strip()
        if not message_text:
            raise ValidationError({"message": "This field is required."})

        AgentMessage.objects.create(
            conversation=conversation,
            role=MessageRole.USER.value,
            content=content_blocks_to_json([TextBlock(text=message_text)]),
        )
        run = AgentRun.objects.create(conversation=conversation)
        result = build_engine(conversation).advance(
            run, op_results=[], catalog=conversation.catalog or []
        )
        return Response(advance_result_to_dict(run, result))


class AgentRunViewSet(viewsets.GenericViewSet):
    permission_classes = [CanWriteOrganisation]
    lookup_value_regex = "[0-9a-f-]{36}"

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        return AgentRun.objects.filter(
            conversation__project__organisation=active_org
        ).select_related("conversation__project")

    @action(detail=True, methods=["post"])
    def advance(self, request, pk=None):
        run = self.get_object()
        op_results = request.data.get("op_results") or []
        if not isinstance(op_results, list):
            raise ValidationError({"op_results": "Must be a list."})
        conversation = run.conversation
        result = build_engine(conversation).advance(
            run, op_results=op_results, catalog=conversation.catalog or []
        )
        return Response(advance_result_to_dict(run, result))
```

> Note: `AgentRunViewSet` is referenced by `urls.py` below and its `advance` action is tested in Task 6 — it is defined here so the whole viewset module lands in one coherent commit.

`server/agent/urls.py`:

```python
from rest_framework.routers import DefaultRouter

from .views import AgentConversationViewSet, AgentRunViewSet

router = DefaultRouter()
router.register(r"conversations", AgentConversationViewSet, basename="agent-conversation")
router.register(r"runs", AgentRunViewSet, basename="agent-run")

urlpatterns = router.urls
```

In `server/orqestra/urls.py`, add to `urlpatterns` (before the `cloud_services` catch-all `path("", ...)`):

```python
    path("agent/", include("agent.urls")),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_api -v 2`
Expected: PASS (4 tests OK)

- [ ] **Step 5: Commit**

```bash
git add server/agent/views.py server/agent/urls.py server/orqestra/urls.py server/agent/tests/test_api.py
git commit -m "feat(agent): add conversation viewset and URL wiring"
```

---

## Task 5: `send` action runs the first turn

The viewset code already includes `send` (Task 4). This task adds its behavioral tests with a patched provider.

**Files:**
- Test: `server/agent/tests/test_api.py` (append a new test class)

- [ ] **Step 1: Write the failing test**

Append to `server/agent/tests/test_api.py`:

```python
from unittest.mock import patch

from agent.constants import MessageRole, RunStatus
from agent.llm.types import Stop, TextDelta, ToolCallRequested, Usage
from agent.tests.fakes import FakeLLMProvider


@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class SendActionTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation, name="P", nodes=[], edges=[]
        )
        self.conversation = AgentConversation.objects.create(
            project=self.project,
            created_by=self.user,
            catalog=[{"id": "lambda", "name": "AWS Lambda", "category": "compute"}],
        )

    @patch("agent.views.get_active_provider")
    def test_send_runs_first_turn_and_returns_ops(self, mock_get_provider):
        mock_get_provider.return_value = FakeLLMProvider([
            [
                TextDelta(text="Adding a Lambda."),
                ToolCallRequested(id="tc_1", name="add_resource", input={"service_id": "lambda"}),
                Usage(input_tokens=10, output_tokens=4),
                Stop(reason="tool_use"),
            ]
        ])

        response = self.client.post(
            reverse("agent-conversation-send", args=[self.conversation.id]),
            {"message": "Build me a web API."},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], RunStatus.AWAITING_CLIENT.value)
        self.assertEqual(response.data["ops"][0]["name"], "add_resource")
        self.assertEqual(response.data["ops"][0]["risk"], "safe")
        self.assertEqual(
            self.conversation.messages.filter(role=MessageRole.USER.value).count(), 1
        )

    def test_send_requires_message(self):
        response = self.client.post(
            reverse("agent-conversation-send", args=[self.conversation.id]),
            {"message": "  "},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
```

- [ ] **Step 2: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_api.SendActionTests -v 2`
Expected: PASS (2 tests OK) — the `send` action already exists from Task 4. If it fails, fix `views.py`.

- [ ] **Step 3: Commit**

```bash
git add server/agent/tests/test_api.py
git commit -m "test(agent): cover the conversation send action"
```

---

## Task 6: `advance` action runs subsequent turns

The `AgentRunViewSet.advance` code already landed in Task 4. This task adds its behavioral tests.

**Files:**
- Test: `server/agent/tests/test_api.py` (append a new test class)

- [ ] **Step 1: Write the failing test**

Append to `server/agent/tests/test_api.py`:

```python
@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class AdvanceActionTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation, name="P", nodes=[], edges=[]
        )
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user, catalog=[]
        )
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.USER.value,
            content=[{"type": "text", "text": "Add a lambda."}],
        )
        self.run = AgentRun.objects.create(conversation=self.conversation)

    @patch("agent.views.get_active_provider")
    def test_advance_with_op_results_completes_run(self, mock_get_provider):
        mock_get_provider.return_value = FakeLLMProvider([
            [TextDelta(text="Done."), Usage(input_tokens=3, output_tokens=1), Stop(reason="end_turn")]
        ])

        response = self.client.post(
            reverse("agent-run-advance", args=[self.run.id]),
            {"op_results": [{"tool_call_id": "tc_1", "content": "node n1 added", "is_error": False}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], RunStatus.COMPLETED.value)
        self.assertEqual(response.data["ops"], [])
        self.assertEqual(
            self.conversation.messages.filter(role=MessageRole.TOOL.value).count(), 1
        )

    def test_advance_rejects_non_list_op_results(self):
        response = self.client.post(
            reverse("agent-run-advance", args=[self.run.id]),
            {"op_results": "nope"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_advance_run_from_other_org_is_not_found(self):
        other_user = User.objects.create_user(
            email="o@example.com", password="TestPassword123!", name="O"
        )
        other_org = Organisation.objects.create(name="Other", owner=other_user)
        other_project = Project.objects.create(organisation=other_org, name="X")
        other_conversation = AgentConversation.objects.create(
            project=other_project, created_by=other_user
        )
        other_run = AgentRun.objects.create(conversation=other_conversation)

        response = self.client.post(
            reverse("agent-run-advance", args=[other_run.id]),
            {"op_results": []},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
```

- [ ] **Step 2: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_api.AdvanceActionTests -v 2`
Expected: PASS (3 tests OK). If the other-org case returns 403 instead of 404, confirm `AgentRun.organisation` property exists (Task 2) and the queryset scoping is in place.

- [ ] **Step 3: Commit**

```bash
git add server/agent/tests/test_api.py
git commit -m "test(agent): cover the run advance action"
```

---

## Task 7: Full HTTP loop integration test

**Files:**
- Test: `server/agent/tests/test_api_integration.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_api_integration.py`:

```python
from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from orqestra.tests import BaseTestCase
from projects.models import Project

from agent.constants import RunStatus
from agent.llm.types import Stop, TextDelta, ToolCallRequested, Usage
from agent.models import AgentConversation
from agent.tests.fakes import FakeLLMProvider


@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class ApiLoopTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation, name="P", nodes=[], edges=[]
        )

    @patch("agent.views.get_active_provider")
    def test_create_send_advance_completes(self, mock_get_provider):
        # One provider instance with two scripted turns: send consumes turn 1,
        # advance consumes turn 2.
        mock_get_provider.return_value = FakeLLMProvider([
            [
                TextDelta(text="Adding a Lambda."),
                ToolCallRequested(id="tc_1", name="add_resource", input={"service_id": "lambda"}),
                Usage(input_tokens=20, output_tokens=8),
                Stop(reason="tool_use"),
            ],
            [
                TextDelta(text="Your Lambda is ready."),
                Usage(input_tokens=25, output_tokens=6),
                Stop(reason="end_turn"),
            ],
        ])

        create = self.client.post(
            reverse("agent-conversation-list"),
            {"project": str(self.project.id), "catalog": [{"id": "lambda", "name": "AWS Lambda"}]},
            format="json",
        )
        self.assertEqual(create.status_code, 201)
        conversation_id = create.data["id"]

        send = self.client.post(
            reverse("agent-conversation-send", args=[conversation_id]),
            {"message": "Add a lambda."},
            format="json",
        )
        self.assertEqual(send.data["status"], RunStatus.AWAITING_CLIENT.value)
        run_id = send.data["run_id"]
        self.assertEqual(send.data["ops"][0]["name"], "add_resource")

        advance = self.client.post(
            reverse("agent-run-advance", args=[run_id]),
            {"op_results": [{"tool_call_id": "tc_1", "content": "node n1 added; validate ok", "is_error": False}]},
            format="json",
        )
        self.assertEqual(advance.data["status"], RunStatus.COMPLETED.value)

        conversation = AgentConversation.objects.get(id=conversation_id)
        # user + assistant(turn1) + tool + assistant(turn2)
        self.assertEqual(conversation.messages.count(), 4)
        run = conversation.runs.get(id=run_id)
        self.assertEqual(run.turn_count, 2)
        self.assertEqual(run.input_tokens, 45)
```

- [ ] **Step 2: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_api_integration -v 2`
Expected: PASS (1 test OK). All dependencies exist from Tasks 1–6.

- [ ] **Step 3: Run the full agent suite + system check**

Run: `docker compose run --rm server python manage.py test agent -v 1`
Expected: all tests PASS (Plan A + Plan B).
Run: `docker compose run --rm server python manage.py check`
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 4: Commit**

```bash
git add server/agent/tests/test_api_integration.py
git commit -m "test(agent): add full HTTP loop integration test"
```

---

## Done criteria for Plan B

- [ ] `docker compose run --rm server python manage.py test agent` passes (Plan A + B).
- [ ] `docker compose run --rm server python manage.py check` passes.
- [ ] A client can: `POST /agent/conversations/` (with catalog) → `POST /agent/conversations/{id}/send/` (message) → `POST /agent/runs/{id}/advance/` (op_results) until `status == "completed"`, with agent lifecycle events broadcast to the `project_{id}` WebSocket group.

## API reference (for Plan C)

| Method | URL | Body | Returns |
|---|---|---|---|
| POST | `/agent/conversations/` | `{project, catalog}` | conversation `{id, project, title, status, ...}` |
| GET | `/agent/conversations/?project=<id>` | — | list of conversations |
| GET | `/agent/conversations/{id}/` | — | conversation with nested `messages` |
| POST | `/agent/conversations/{id}/send/` | `{message}` | `{run_id, status, assistant_text, ops:[{tool_call_id,name,input,risk}]}` |
| POST | `/agent/runs/{id}/advance/` | `{op_results:[{tool_call_id,content,is_error}]}` | same advance shape |

WebSocket (subscribe `{action:"subscribe", group:"project", id:<projectId>}`): events `agent.message.delta`, `agent.tool_call`, `agent.op_applied`, `agent.run.completed`, `agent.run.failed`.

## Hand-off to Plan C (frontend)

Plan C wires: catalog projection from the frontend service registry; the agent panel (chat + requirements tracker + "watch it build"); the op-executor that applies each returned op via the existing registry/`GraphEngine`, persists via `updateProject`, and posts `op_results` back to `advance`; WebSocket subscription to the `agent.*` events; and risk-graded confirm (coarse risk arrives on each op; fine-grained cost/security risk computed client-side).
