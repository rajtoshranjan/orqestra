from annotations.constants import AnnotationEventType, AuthorType, NotificationVerb
from annotations.models import Annotation, AnnotationEvent, Comment, Notification
from annotations.serializers import CommentSerializer
from django.db import transaction
from organisations.helpers import get_active_organisation, log_action
from organisations.permissions import CanWriteOrganisation, IsOrganisationMember
from realtime.events import send_agent_event
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .constants import AGENT_ID, MessageRole, RunStatus
from .engine import AgentEngine
from .llm.registry import build_provider, resolve_llm_config
from .llm.types import TextBlock, content_blocks_to_json
from .models import AgentConversation, AgentMessage, AgentRun
from .ops import describe_pending_confirmation
from .serializers import (
    AdvanceRequestSerializer,
    AgentConversationDetailSerializer,
    AgentConversationSerializer,
    AgentRunSerializer,
    AnnotationReplySerializer,
    SendMessageSerializer,
    advance_result_to_dict,
)

# Reported when a caller tries to start a second run on a conversation that is
# still mid-flight. 409 rather than 400: the request is well-formed, the
# conversation just isn't ready for it.
LIVE_RUN_CONFLICT = {
    "detail": "This conversation already has a run in progress. "
    "Wait for it to finish, or cancel it first."
}


# Shown when an organisation has added no model at all. Actionable rather than
# a raw provider failure: the reader usually can't fix it themselves.
NO_MODEL_CONFIGURED = (
    "No AI model is configured for this organisation. An owner or admin can "
    "add one in Settings → AI Models."
)


def build_engine(conversation: AgentConversation) -> AgentEngine:
    """Build an engine for this conversation's resolved model config.

    The provider is built per run from the organisation's credentials, so a
    project override and an organisation default can coexist in one process.
    `emit_event` already swallows its own transport errors, so the sink here is
    a thin adapter rather than a second try/except.
    """
    config = resolve_llm_config(conversation.project)
    if config is None:
        raise ValidationError({"llm_config": NO_MODEL_CONFIGURED})

    project_id = str(conversation.project_id)

    def sink(event_type: str, payload: dict) -> None:
        send_agent_event(project_id, event_type, payload)

    return AgentEngine(provider=build_provider(config), event_sink=sink)


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
            params = self.request.query_params
            project_id = params.get("project")
            if project_id:
                queryset = queryset.filter(project_id=project_id)
            # Standalone "build chat" conversations only — keeps annotation-anchored
            # threads out of the agent panel's rehydrate.
            if params.get("standalone") == "true":
                queryset = queryset.filter(annotation__isnull=True)
            annotation_id = params.get("annotation")
            if annotation_id:
                queryset = queryset.filter(annotation_id=annotation_id)
        return queryset

    def perform_create(self, serializer):
        active_org = get_active_organisation(self.request)
        project = serializer.validated_data.get("project")
        if project.organisation_id != active_org.id:
            raise ValidationError(
                {"project": "Project must belong to the active organisation."}
            )
        annotation = serializer.validated_data.get("annotation")
        if annotation is not None and annotation.project_id != project.id:
            raise ValidationError(
                {"annotation": "Annotation must belong to the same project."}
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
        payload = SendMessageSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        with transaction.atomic():
            # A second run on the same conversation would interleave messages and
            # corrupt the replayed history, so take the conversation row first.
            locked = AgentConversation.objects.select_for_update().get(
                pk=conversation.pk
            )
            # A tab closed mid-run would otherwise block this conversation
            # forever, so retire anything abandoned before checking.
            locked.runs.expire_stale()
            if locked.runs.live().exists():
                return Response(LIVE_RUN_CONFLICT, status=status.HTTP_409_CONFLICT)

            AgentMessage.objects.create(
                conversation=locked,
                role=MessageRole.USER.value,
                content=content_blocks_to_json(
                    [TextBlock(text=payload.validated_data["message"])]
                ),
            )
            run = AgentRun.objects.create(conversation=locked)

        result = build_engine(conversation).advance(
            run,
            op_results=[],
            catalog=conversation.catalog or [],
            graph=payload.validated_data.get("graph"),
        )
        return Response(advance_result_to_dict(run, result))


class AgentRunViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [CanWriteOrganisation]
    serializer_class = AgentRunSerializer
    lookup_value_regex = "[0-9a-f-]{36}"

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        return AgentRun.objects.filter(
            conversation__project__organisation=active_org
        ).select_related("conversation__project")

    @action(detail=True, methods=["post"])
    def advance(self, request, pk=None):
        payload = AdvanceRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        with transaction.atomic():
            run = (
                self.get_queryset().select_for_update().filter(pk=pk).first()
            ) or self.get_object()
            if not run.is_advanceable:
                raise ValidationError(
                    {
                        "run": f"This run is {run.status} and has no outstanding "
                        "work to report."
                    }
                )
            # The client is the source of truth for op results, but only for the
            # calls actually outstanding: a retry or a stale confirmation would
            # otherwise write a duplicate or orphan tool_result that no repair
            # pass can distinguish from a real one.
            outstanding = run.outstanding_tool_call_ids()
            seen: set[str] = set()
            op_results = []
            for item in payload.validated_data["op_results"]:
                call_id = item["tool_call_id"]
                if call_id in outstanding and call_id not in seen:
                    seen.add(call_id)
                    op_results.append(item)
            run.status = RunStatus.RUNNING.value
            run.save(update_fields=["status", "updated_at"])

        conversation = run.conversation
        result = build_engine(conversation).advance(
            run,
            op_results=op_results,
            catalog=conversation.catalog or [],
            graph=payload.validated_data.get("graph"),
        )
        return Response(advance_result_to_dict(run, result))

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Stop a run the user no longer wants. The engine checks before each turn."""
        run = self.get_object()
        if run.is_terminal:
            raise ValidationError({"run": f"This run is already {run.status}."})
        run.status = RunStatus.CANCELLED.value
        run.save(update_fields=["status", "updated_at"])
        return Response(AgentRunSerializer(run).data)


class AgentAnnotationViewSet(viewsets.GenericViewSet):
    permission_classes = [CanWriteOrganisation]
    lookup_value_regex = "[0-9a-f-]{36}"

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        return Annotation.objects.filter(
            project__organisation=active_org
        ).select_related("project", "author")

    def _runs_for(self, annotation):
        """Runs whose conversation is anchored to this thread, in this org."""
        active_org = get_active_organisation(self.request)
        return AgentRun.objects.filter(
            conversation__annotation=annotation,
            conversation__project__organisation=active_org,
        ).select_related("conversation")

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        """Post an agent reply into a thread, derived from the run that produced it.

        The body is never taken from the request: a comment carrying the agent's
        name and avatar has to be something the agent actually said, or the
        attribution is worthless.
        """
        annotation = self.get_object()
        payload = AnnotationReplySerializer(
            data=request.data, runs=self._runs_for(annotation)
        )
        payload.is_valid(raise_exception=True)
        run = payload.validated_data["run"]

        body = self._body_for(run)
        if not body:
            raise ValidationError({"run": "This run produced nothing to post."})

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

    @staticmethod
    def _body_for(run: AgentRun) -> str:
        if run.status == RunStatus.FAILED.value:
            return f"I couldn't complete that request: {run.error}"
        if run.status == RunStatus.CANCELLED.value:
            return "I stopped working on this request."
        if run.status == RunStatus.AWAITING_CLIENT.value:
            # A paused run asks its question in the thread. The text is built
            # from the run's own outstanding ops so it is still the agent
            # speaking, not the caller.
            return describe_pending_confirmation(run)
        return run.narration()

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
