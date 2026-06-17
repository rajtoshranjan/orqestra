import logging

from django.db import transaction
from organisations.helpers import get_active_organisation, log_action
from organisations.permissions import CanWriteOrganisation, IsOrganisationMember
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from annotations.constants import AnnotationEventType, AuthorType, NotificationVerb
from annotations.models import Annotation, AnnotationEvent, Comment, Notification
from annotations.serializers import CommentSerializer
from realtime.events import send_agent_event

from .constants import AGENT_ID, MessageRole
from .engine import AgentEngine
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
            details={
                "conversation_id": str(conversation.id),
                "project_id": str(project.id),
            },
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
