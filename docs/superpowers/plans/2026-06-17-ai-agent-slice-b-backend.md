# AI Agent — Slice B Backend (Agent Replies in Annotations)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the agent post a reply into an annotation thread as an agent-authored comment, so the annotation-tagging flow can confirm its work in-thread.

**Architecture:** The annotation-tagging run stays client-driven (server brain + client hands): a client detects the `@Orqestra` mention, runs the existing agent loop, applies ops to the canvas, then calls a new endpoint to post the agent's summary as a `Comment(author_type=agent, origin=<agent-id>)` on the annotation — emitting the same activity event + notification a human reply would.

**Tech Stack:** Django/DRF, the existing `annotations` app (models/serializers/events), the `agent` app. Builds on Plans A/B.

**Depends on:** Plans A + B (the `agent` app and `realtime.events` exist).

**Scope boundaries:**
- IN: agent identity constants; an `AgentAnnotationViewSet.reply` endpoint that creates an agent comment + `COMMENT_ADDED` event + notification + realtime emit; URL wiring; tests.
- OUT (Slice B frontend plan): the `@Orqestra` mention picker/token rendering, detecting the mention, the anchored agent run, and posting the reply from the client.

**Conventions:** backend ops via `docker compose run --rm server python manage.py ...`; mirror the `annotations` viewset/event pattern; reuse `CommentSerializer`; no raw exceptions; tests subclass `orqestra.tests.BaseTestCase`.

**Key facts (verified):**
- `Comment` has nullable `author` (`on_delete=SET_NULL`), plus `author_type` (default `user`) and `origin` (default `""`); `AuthorType.AGENT = "agent"` already exists (`annotations/constants.py`).
- `AnnotationEventType.COMMENT_ADDED` and `NotificationVerb.REPLIED` exist.
- `Notification` requires `organisation` (FK) and allows null `actor`.
- `CommentSerializer` (`annotations/serializers.py`) exposes `author_type`/`origin` and tolerates `author=None` (name/email default to `""`).
- `CanWriteOrganisation.has_object_permission` resolves an `Annotation` via its `project.organisation` chain.
- Realtime: `send_annotation_event(project_id, "updated", payload)` and `send_notification_event(org_id, "created", payload)` exist (`realtime/events.py`).

---

## File Structure

```
server/agent/constants.py   # ADD: AGENT_ID, AGENT_DISPLAY_NAME
server/agent/views.py       # ADD: AgentAnnotationViewSet (reply action)
server/agent/urls.py        # ADD: register the annotations route
server/agent/tests/test_annotation_reply.py  # NEW
```

---

## Task 1: Agent identity + reply endpoint (comment + event)

**Files:**
- Modify: `server/agent/constants.py`
- Modify: `server/agent/views.py`
- Modify: `server/agent/urls.py`
- Test: `server/agent/tests/test_annotation_reply.py`

- [ ] **Step 1: Write the failing test**

`server/agent/tests/test_annotation_reply.py`:

```python
from annotations.models import Annotation, Comment
from django.test import override_settings
from django.urls import reverse
from organisations.models import Organisation
from orqestra.tests import BaseTestCase
from projects.models import Project
from rest_framework import status

from accounts.models import User
from agent.constants import AGENT_ID


@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class AgentAnnotationReplyTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation, name="P", nodes=[], edges=[]
        )
        self.annotation = Annotation.objects.create(
            project=self.project,
            author=self.user,
            target_type="node",
            target_id="node-1",
        )

    def test_reply_creates_agent_authored_comment(self):
        response = self.client.post(
            reverse("agent-annotation-reply", args=[self.annotation.id]),
            {"body": "Added a cache in front of the database."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        comment = Comment.objects.get()
        self.assertEqual(comment.author_type, "agent")
        self.assertEqual(comment.origin, AGENT_ID)
        self.assertIsNone(comment.author)
        self.assertEqual(comment.body, "Added a cache in front of the database.")
        self.assertEqual(self.annotation.events.filter(event_type="comment_added").count(), 1)

    def test_reply_requires_a_body(self):
        response = self.client.post(
            reverse("agent-annotation-reply", args=[self.annotation.id]),
            {"body": "   "},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reply_on_other_org_annotation_is_not_found(self):
        other_user = User.objects.create_user(
            email="o@example.com", password="TestPassword123!", name="O"
        )
        other_org = Organisation.objects.create(name="Other", owner=other_user)
        other_project = Project.objects.create(organisation=other_org, name="X")
        other_annotation = Annotation.objects.create(
            project=other_project, author=other_user, target_type="node", target_id="n"
        )

        response = self.client.post(
            reverse("agent-annotation-reply", args=[other_annotation.id]),
            {"body": "hi"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm server python manage.py test agent.tests.test_annotation_reply -v 2`
Expected: FAIL — `AGENT_ID` not importable / reverse name `agent-annotation-reply` not found.

- [ ] **Step 3: Add the identity constants**

In `server/agent/constants.py`, add at the bottom:

```python
# Stable identity for agent-authored content (Comment.origin, mention tokens).
AGENT_ID = "orqestra"
AGENT_DISPLAY_NAME = "Orqestra"
```

- [ ] **Step 4: Add the viewset**

In `server/agent/views.py`, change the existing `from rest_framework import mixins, viewsets` line to include `status`:

```python
from rest_framework import mixins, status, viewsets
```

Then add these imports to the import block:

```python
from django.db import transaction
from annotations.constants import AnnotationEventType, AuthorType, NotificationVerb
from annotations.models import Annotation, AnnotationEvent, Comment, Notification
from annotations.serializers import CommentSerializer

from .constants import AGENT_ID
```

Then append the viewset at the end of the file:

```python
class AgentAnnotationViewSet(viewsets.GenericViewSet):
    permission_classes = [CanWriteOrganisation]
    lookup_value_regex = "[0-9a-f-]{36}"

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        return Annotation.objects.filter(
            project__organisation=active_org
        ).select_related("project", "author")

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        annotation = self.get_object()
        body = (request.data.get("body") or "").strip()
        if not body:
            raise ValidationError({"body": "This field is required."})

        with transaction.atomic():
            comment = Comment.objects.create(
                annotation=annotation,
                author=None,
                author_type=AuthorType.AGENT.value,
                origin=AGENT_ID,
                body=body,
            )
            AnnotationEvent.objects.create(
                annotation=annotation,
                actor=None,
                event_type=AnnotationEventType.COMMENT_ADDED.value,
            )
            self._notify_author(request, annotation, comment)
            annotation.save(update_fields=["updated_at"])

        self._emit_events(annotation)
        return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    def _notify_author(self, request, annotation, comment):
        if annotation.author_id and annotation.author_id != request.user.id:
            Notification.objects.create(
                recipient=annotation.author,
                actor=None,
                organisation=annotation.project.organisation,
                verb=NotificationVerb.REPLIED.value,
                annotation=annotation,
                comment=comment,
            )

    def _emit_events(self, annotation):
        try:
            from realtime.events import send_annotation_event, send_notification_event

            send_annotation_event(
                project_id=str(annotation.project_id),
                event_type="updated",
                payload={"annotation_id": str(annotation.id), "action": "agent_reply"},
            )
            send_notification_event(
                org_id=str(annotation.project.organisation_id),
                event_type="created",
                payload={"action": "agent_reply"},
            )
        except Exception as error:  # noqa: BLE001
            logger.error(f"Failed to emit events on agent reply: {error}")
```

- [ ] **Step 5: Register the route**

In `server/agent/urls.py`, import and register the new viewset:

```python
from rest_framework.routers import DefaultRouter

from .views import (
    AgentAnnotationViewSet,
    AgentConversationViewSet,
    AgentRunViewSet,
)

router = DefaultRouter()
router.register(r"conversations", AgentConversationViewSet, basename="agent-conversation")
router.register(r"runs", AgentRunViewSet, basename="agent-run")
router.register(r"annotations", AgentAnnotationViewSet, basename="agent-annotation")

urlpatterns = router.urls
```

- [ ] **Step 6: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_annotation_reply -v 2`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add server/agent/constants.py server/agent/views.py server/agent/urls.py server/agent/tests/test_annotation_reply.py
git commit -m "feat(agent): add agent annotation reply endpoint"
```

---

## Task 2: Notify the annotation author

The notification logic landed in Task 1 (`_notify_author`). This task adds the behavioral tests.

**Files:**
- Test: `server/agent/tests/test_annotation_reply.py` (append a class)

- [ ] **Step 1: Write the test**

Append to `server/agent/tests/test_annotation_reply.py`:

```python
from annotations.models import Notification
from organisations.constants import OrganisationMemberRole
from organisations.models import OrganisationMember


@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class AgentReplyNotificationTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation, name="P", nodes=[], edges=[]
        )

    def test_notifies_a_different_annotation_author(self):
        author = User.objects.create_user(
            email="author@example.com", password="TestPassword123!", name="Author"
        )
        OrganisationMember.objects.create(
            organisation=self.organisation,
            user=author,
            role=OrganisationMemberRole.REGULAR.value,
        )
        annotation = Annotation.objects.create(
            project=self.project, author=author, target_type="node", target_id="n"
        )

        self.client.post(
            reverse("agent-annotation-reply", args=[annotation.id]),
            {"body": "done"},
            format="json",
        )

        notification = Notification.objects.get(recipient=author)
        self.assertEqual(notification.verb, "replied")
        self.assertIsNone(notification.actor)

    def test_does_not_notify_when_requester_is_the_author(self):
        annotation = Annotation.objects.create(
            project=self.project, author=self.user, target_type="node", target_id="n"
        )

        self.client.post(
            reverse("agent-annotation-reply", args=[annotation.id]),
            {"body": "done"},
            format="json",
        )

        self.assertEqual(Notification.objects.count(), 0)
```

- [ ] **Step 2: Run test to verify it passes**

Run: `docker compose run --rm server python manage.py test agent.tests.test_annotation_reply -v 2`
Expected: PASS (5 tests total). The behavior already exists from Task 1; if a test fails, fix `_notify_author`.

- [ ] **Step 3: Commit**

```bash
git add server/agent/tests/test_annotation_reply.py
git commit -m "test(agent): cover agent reply notifications"
```

---

## Task 3: Full verification

- [ ] **Step 1: Run the full agent suite + system check**

Run: `docker compose run --rm server python manage.py test agent -v 1`
Expected: all tests PASS (Plans A/B + Slice B backend).
Run: `docker compose run --rm server python manage.py check`
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 2: Commit (only if fixes were needed)**

```bash
git add -A && git commit -m "chore(agent): slice B backend verification green"
```

(Skip if nothing is staged.)

---

## Done criteria

- [ ] `docker compose run --rm server python manage.py test agent` passes.
- [ ] `POST /agent/annotations/{id}/reply/` with `{body}` creates an agent-authored comment (`author_type=agent`, `origin=orqestra`), a `comment_added` event, a `replied` notification to a different author, and emits the annotation/notification realtime events.

## Hand-off to Slice B frontend

The frontend plan will: add `@Orqestra` to the mention composer + render `agent:` tokens; detect an agent mention when a comment is submitted; run the agent loop anchored to that annotation (seed the message from the comment body + target node/edge context; apply safe ops, hold risky ones with a note); and `POST /agent/annotations/{id}/reply/` with the agent's summary. Agent comments render with the Orqestra identity (`author_type === 'agent'`).
