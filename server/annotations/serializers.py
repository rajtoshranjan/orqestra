from django.db import transaction
from organisations.helpers import get_active_organisation
from rest_framework import serializers

from .constants import MAX_COMMENT_LENGTH, AnnotationEventType, AnnotationTargetType
from .mentions import sync_mentions
from .models import Annotation, AnnotationEvent, Comment, Notification, Reaction


class ReactionSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.name", read_only=True)

    class Meta:
        model = Reaction
        fields = ["id", "emoji", "user", "user_name"]
        read_only_fields = fields


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(
        source="author.name", read_only=True, default=""
    )
    author_email = serializers.CharField(
        source="author.email", read_only=True, default=""
    )
    reactions = ReactionSerializer(many=True, read_only=True)
    mention_user_ids = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id",
            "annotation",
            "author",
            "author_name",
            "author_email",
            "author_type",
            "origin",
            "body",
            "edited_at",
            "reactions",
            "mention_user_ids",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "author",
            "author_type",
            "origin",
            "edited_at",
            "created_at",
        ]

    def get_mention_user_ids(self, obj):
        return [str(mention.user_id) for mention in obj.mentions.all()]

    def validate_body(self, value):
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Comment body cannot be empty.")
        if len(stripped) > MAX_COMMENT_LENGTH:
            raise serializers.ValidationError(
                f"Comment body cannot exceed {MAX_COMMENT_LENGTH} characters."
            )
        return stripped


class AnnotationSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(
        source="author.name", read_only=True, default=""
    )
    resolved_by_name = serializers.CharField(
        source="resolved_by.name", read_only=True, default=""
    )
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Annotation
        fields = [
            "id",
            "project",
            "target_type",
            "target_id",
            "position",
            "status",
            "archived",
            "author",
            "author_name",
            "author_type",
            "origin",
            "resolved_by",
            "resolved_by_name",
            "resolved_at",
            "comments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class AnnotationCreateSerializer(serializers.ModelSerializer):
    body = serializers.CharField(write_only=True, max_length=MAX_COMMENT_LENGTH)

    class Meta:
        model = Annotation
        fields = ["project", "target_type", "target_id", "position", "body"]

    def validate_body(self, value):
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Comment body cannot be empty.")
        return stripped

    def validate(self, attrs):
        request = self.context["request"]
        active_org = get_active_organisation(request)

        errors = {}
        project = attrs.get("project")
        if project and project.organisation != active_org:
            errors["project"] = "Project must belong to the active organisation."

        target_type = attrs.get("target_type")
        target_id = attrs.get("target_id", "")
        position = attrs.get("position") or {}

        if target_type == AnnotationTargetType.CANVAS.value:
            x = position.get("x")
            y = position.get("y")
            if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
                errors[
                    "position"
                ] = "Canvas annotations require a position with numeric x and y."
        elif not target_id:
            errors[
                "target_id"
            ] = f"Annotations targeting a {target_type} require a target_id."

        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        active_org = get_active_organisation(request)
        body = validated_data.pop("body")

        with transaction.atomic():
            annotation = Annotation.objects.create(
                author=request.user, **validated_data
            )
            comment = Comment.objects.create(
                annotation=annotation, author=request.user, body=body
            )
            sync_mentions(comment, active_org, request.user)
            AnnotationEvent.objects.create(
                annotation=annotation,
                actor=request.user,
                event_type=AnnotationEventType.CREATED.value,
            )
        return annotation


class AnnotationUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Annotation
        fields = ["position"]


class AnnotationEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.name", read_only=True, default="")

    class Meta:
        model = AnnotationEvent
        fields = [
            "id",
            "annotation",
            "actor",
            "actor_name",
            "event_type",
            "details",
            "created_at",
        ]
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.name", read_only=True, default="")
    project_id = serializers.CharField(
        source="annotation.project_id", read_only=True, default=""
    )
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "verb",
            "actor",
            "actor_name",
            "annotation",
            "comment",
            "project_id",
            "preview",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_preview(self, obj):
        if obj.comment:
            return obj.comment.body[:120]
        return ""
