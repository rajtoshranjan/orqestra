import logging

from organisations.helpers import get_active_organisation, log_action
from organisations.permissions import CanWriteOrganisation, IsOrganisationMember
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from realtime.events import send_agent_event

from .constants import MessageRole
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
