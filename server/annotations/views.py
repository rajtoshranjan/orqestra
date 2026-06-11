from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from organisations.helpers import get_active_organisation, log_action

from .constants import (
    ALLOWED_REACTION_EMOJIS,
    AnnotationEventType,
    AnnotationStatus,
    NotificationVerb,
)
from .mentions import sync_mentions
from .models import Annotation, AnnotationEvent, Comment, Notification, Reaction
from .permissions import (
    CanParticipateInAnnotations,
    can_moderate,
    can_resolve,
    get_org_role,
)
from .serializers import (
    AnnotationCreateSerializer,
    AnnotationEventSerializer,
    AnnotationSerializer,
    AnnotationUpdateSerializer,
    CommentSerializer,
    NotificationSerializer,
    ReactionSerializer,
)


class AnnotationViewSet(viewsets.ModelViewSet):
    permission_classes = [CanParticipateInAnnotations]
    lookup_value_regex = "[0-9a-f-]{36}"

    def get_serializer_class(self):
        if self.action == "create":
            return AnnotationCreateSerializer
        if self.action in ["update", "partial_update"]:
            return AnnotationUpdateSerializer
        return AnnotationSerializer

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        queryset = Annotation.objects.for_organisation(active_org).with_related()
        if self.action == "list":
            project_id = self.request.query_params.get("project")
            if not project_id:
                raise ValidationError({"project": "This query parameter is required."})
            queryset = queryset.for_project(project_id).apply_filters(
                self.request.query_params, self.request.user
            )
        return queryset

    def _role(self):
        active_org = get_active_organisation(self.request)
        return active_org, get_org_role(active_org, self.request.user)

    def perform_create(self, serializer):
        annotation = serializer.save()
        active_org = get_active_organisation(self.request)
        log_action(
            organisation=active_org,
            actor=self.request.user,
            action="annotation.create",
            details={
                "annotation_id": str(annotation.id),
                "project_id": str(annotation.project_id),
                "target_type": annotation.target_type,
            },
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        annotation = Annotation.objects.with_related().get(id=serializer.instance.id)
        return Response(
            AnnotationSerializer(annotation).data, status=status.HTTP_201_CREATED
        )

    def perform_update(self, serializer):
        annotation = self.get_object()
        _, role = self._role()
        if annotation.author != self.request.user and not can_resolve(
            role, annotation, self.request.user
        ):
            raise PermissionDenied("You cannot move this annotation.")
        with transaction.atomic():
            serializer.save()
            AnnotationEvent.objects.create(
                annotation=annotation,
                actor=self.request.user,
                event_type=AnnotationEventType.MOVED.value,
            )

    def perform_destroy(self, instance):
        _, role = self._role()
        if instance.author != self.request.user and not can_moderate(role):
            raise PermissionDenied("Only the author or an admin can delete this annotation.")
        organisation = instance.project.organisation
        details = {
            "annotation_id": str(instance.id),
            "project_id": str(instance.project_id),
        }
        instance.delete()
        log_action(
            organisation=organisation,
            actor=self.request.user,
            action="annotation.delete",
            details=details,
        )

    def _transition(self, annotation, *, status_value, archived, event_type):
        with transaction.atomic():
            if status_value == AnnotationStatus.RESOLVED.value:
                annotation.status = status_value
                annotation.resolved_by = self.request.user
                annotation.resolved_at = timezone.now()
            elif status_value == AnnotationStatus.OPEN.value:
                annotation.status = status_value
                annotation.resolved_by = None
                annotation.resolved_at = None
            if archived is not None:
                annotation.archived = archived
            annotation.save()
            AnnotationEvent.objects.create(
                annotation=annotation,
                actor=self.request.user,
                event_type=event_type,
            )
        annotation = Annotation.objects.with_related().get(id=annotation.id)
        return Response(AnnotationSerializer(annotation).data)

    def _check_resolution_permission(self, annotation):
        _, role = self._role()
        if not can_resolve(role, annotation, self.request.user):
            raise PermissionDenied("You cannot change the status of this annotation.")

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        annotation = self.get_object()
        self._check_resolution_permission(annotation)
        response = self._transition(
            annotation,
            status_value=AnnotationStatus.RESOLVED.value,
            archived=None,
            event_type=AnnotationEventType.RESOLVED.value,
        )
        if annotation.author and annotation.author != request.user:
            Notification.objects.create(
                recipient=annotation.author,
                actor=request.user,
                organisation=annotation.project.organisation,
                verb=NotificationVerb.RESOLVED.value,
                annotation=annotation,
            )
        log_action(
            organisation=annotation.project.organisation,
            actor=request.user,
            action="annotation.resolve",
            details={"annotation_id": str(annotation.id)},
        )
        return response

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        annotation = self.get_object()
        self._check_resolution_permission(annotation)
        return self._transition(
            annotation,
            status_value=AnnotationStatus.OPEN.value,
            archived=None,
            event_type=AnnotationEventType.REOPENED.value,
        )

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        annotation = self.get_object()
        self._check_resolution_permission(annotation)
        return self._transition(
            annotation,
            status_value=None,
            archived=True,
            event_type=AnnotationEventType.ARCHIVED.value,
        )

    @action(detail=True, methods=["post"])
    def unarchive(self, request, pk=None):
        annotation = self.get_object()
        self._check_resolution_permission(annotation)
        return self._transition(
            annotation,
            status_value=None,
            archived=False,
            event_type=AnnotationEventType.UNARCHIVED.value,
        )

    @action(detail=True, methods=["get"])
    def events(self, request, pk=None):
        annotation = self.get_object()
        events = annotation.events.select_related("actor")
        return Response(AnnotationEventSerializer(events, many=True).data)


class CommentViewSet(
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CommentSerializer
    permission_classes = [CanParticipateInAnnotations]

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        return Comment.objects.filter(
            annotation__project__organisation=active_org
        ).select_related("annotation__project", "author")

    def _validate_annotation_access(self, annotation_id):
        active_org = get_active_organisation(self.request)
        annotation = (
            Annotation.objects.for_organisation(active_org)
            .filter(id=annotation_id)
            .first()
        )
        if annotation is None:
            raise ValidationError({"annotation": "Annotation not found."})
        return annotation, active_org

    def perform_create(self, serializer):
        annotation_id = self.request.data.get("annotation")
        annotation, active_org = self._validate_annotation_access(annotation_id)

        with transaction.atomic():
            comment = serializer.save(annotation=annotation, author=self.request.user)
            mentioned_ids = sync_mentions(comment, active_org, self.request.user)
            AnnotationEvent.objects.create(
                annotation=annotation,
                actor=self.request.user,
                event_type=AnnotationEventType.COMMENT_ADDED.value,
            )
            self._notify_thread(annotation, comment, mentioned_ids)
            # Touch the annotation so list polling change-detection sees thread activity.
            annotation.save(update_fields=["updated_at"])

    def _notify_thread(self, annotation, comment, mentioned_ids):
        participants = set(
            annotation.comments.exclude(author=None).values_list("author_id", flat=True)
        )
        if annotation.author_id:
            participants.add(annotation.author_id)
        participants.discard(self.request.user.id)
        participants -= set(mentioned_ids)

        Notification.objects.bulk_create(
            [
                Notification(
                    recipient_id=recipient_id,
                    actor=self.request.user,
                    organisation=annotation.project.organisation,
                    verb=NotificationVerb.REPLIED.value,
                    annotation=annotation,
                    comment=comment,
                )
                for recipient_id in participants
            ]
        )

    def perform_update(self, serializer):
        comment = self.get_object()
        if comment.author != self.request.user:
            raise PermissionDenied("Only the author can edit a comment.")
        active_org = get_active_organisation(self.request)
        with transaction.atomic():
            comment = serializer.save(edited_at=timezone.now())
            sync_mentions(comment, active_org, self.request.user)

    def perform_destroy(self, instance):
        active_org = get_active_organisation(self.request)
        role = get_org_role(active_org, self.request.user)
        if instance.author != self.request.user and not can_moderate(role):
            raise PermissionDenied("Only the author or an admin can delete this comment.")
        annotation = instance.annotation
        with transaction.atomic():
            instance.delete()
            AnnotationEvent.objects.create(
                annotation=annotation,
                actor=self.request.user,
                event_type=AnnotationEventType.COMMENT_DELETED.value,
            )
            annotation.save(update_fields=["updated_at"])

    @action(detail=True, methods=["post"])
    def react(self, request, pk=None):
        comment = self.get_object()
        emoji = request.data.get("emoji")
        if emoji not in ALLOWED_REACTION_EMOJIS:
            raise ValidationError({"emoji": "Unsupported reaction emoji."})
        reaction, created = Reaction.objects.get_or_create(
            comment=comment, user=request.user, emoji=emoji
        )
        if not created:
            reaction.delete()
        comment.annotation.save(update_fields=["updated_at"])
        reactions = comment.reactions.select_related("user")
        return Response(ReactionSerializer(reactions, many=True).data)


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [CanParticipateInAnnotations]

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        queryset = Notification.objects.for_recipient(
            self.request.user, active_org
        ).select_related("actor", "annotation", "comment")
        if self.request.query_params.get("unread") == "true":
            queryset = queryset.unread()
        return queryset

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = self.get_queryset().unread().count()
        return Response({"count": count})

    @action(detail=False, methods=["post"], url_path="mark-read")
    def mark_read(self, request):
        queryset = self.get_queryset().unread()
        if not request.data.get("all"):
            ids = request.data.get("ids") or []
            queryset = queryset.filter(id__in=ids)
        updated = queryset.update(read_at=timezone.now())
        return Response({"updated": updated})
