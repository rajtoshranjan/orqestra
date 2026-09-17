import re

from annotations.models import Annotation
from rest_framework import serializers

from .engine import AdvanceResult
from .models import AgentConversation, AgentMessage, AgentRun

# The catalog is client-supplied and is interpolated straight into the system
# prompt, which is the highest-trust position in the request. Bound its size and
# flatten anything that could forge prompt structure.
MAX_CATALOG_ENTRIES = 500
MAX_CATALOG_TEXT = 400
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f]+")


def _flatten(value: str) -> str:
    return _CONTROL_CHARACTERS.sub(" ", value).strip()[:MAX_CATALOG_TEXT]


def sanitise_catalog(catalog: list) -> list[dict]:
    """Strip control characters from every string a catalog entry carries."""
    cleaned: list[dict] = []
    for entry in catalog:
        item: dict = {}
        for key, value in entry.items():
            if isinstance(value, str):
                item[key] = _flatten(value)
            elif isinstance(value, list):
                item[key] = [
                    _flatten(inner) if isinstance(inner, str) else inner
                    for inner in value
                ]
            elif isinstance(value, dict):
                item[key] = {
                    inner_key: (
                        [
                            _flatten(each) if isinstance(each, str) else each
                            for each in inner_value
                        ]
                        if isinstance(inner_value, list)
                        else (
                            _flatten(inner_value)
                            if isinstance(inner_value, str)
                            else inner_value
                        )
                    )
                    for inner_key, inner_value in value.items()
                }
            else:
                item[key] = value
        cleaned.append(item)
    return cleaned


class AgentCatalogField(serializers.ListField):
    """A bounded list of catalog entries, each an object carrying an id."""

    def __init__(self, **kwargs):
        kwargs.setdefault("child", serializers.DictField())
        kwargs.setdefault("max_length", MAX_CATALOG_ENTRIES)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        entries = super().to_internal_value(data)
        for entry in entries:
            if not entry.get("id"):
                raise serializers.ValidationError(
                    "Every catalog entry needs a service id."
                )
        return sanitise_catalog(entries)


class OperationResultSerializer(serializers.Serializer):
    """One tool result reported by the client."""

    tool_call_id = serializers.CharField(max_length=128)
    content = serializers.CharField(allow_blank=True, trim_whitespace=False)
    is_error = serializers.BooleanField(default=False)


class GraphSnapshotSerializer(serializers.Serializer):
    nodes = serializers.ListField(child=serializers.DictField(), required=False)
    edges = serializers.ListField(child=serializers.DictField(), required=False)


class AdvanceRequestSerializer(serializers.Serializer):
    operation_results = OperationResultSerializer(
        many=True, required=False, default=list
    )
    graph = GraphSnapshotSerializer(required=False, allow_null=True)


class SendMessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=8000, trim_whitespace=True)
    graph = GraphSnapshotSerializer(required=False, allow_null=True)


class AnnotationReplySerializer(serializers.Serializer):
    """The reply body is derived from the run, never taken from the caller."""

    run = serializers.PrimaryKeyRelatedField(queryset=AgentRun.objects.none())

    def __init__(self, *args, runs=None, **kwargs):
        super().__init__(*args, **kwargs)
        if runs is not None:
            self.fields["run"].queryset = runs


class AgentMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentMessage
        fields = [
            "id",
            "role",
            "content",
            "input_tokens",
            "output_tokens",
            "created_at",
        ]
        read_only_fields = fields


class AgentRunSerializer(serializers.ModelSerializer):
    """Run state, for resuming a run and for showing what one cost."""

    operations = serializers.SerializerMethodField()

    class Meta:
        model = AgentRun
        fields = [
            "id",
            "conversation",
            "status",
            "turn_count",
            "input_tokens",
            "output_tokens",
            "error",
            "operations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_operations(self, run):
        return run.outstanding_operations()


class AgentConversationSerializer(serializers.ModelSerializer):
    catalog = AgentCatalogField(required=False, write_only=True)
    annotation = serializers.PrimaryKeyRelatedField(
        queryset=Annotation.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = AgentConversation
        fields = [
            "id",
            "project",
            "annotation",
            "title",
            "status",
            "catalog",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_at", "updated_at"]


class AgentConversationDetailSerializer(serializers.ModelSerializer):
    messages = AgentMessageSerializer(many=True, read_only=True)
    active_run = serializers.SerializerMethodField()

    class Meta:
        model = AgentConversation
        fields = [
            "id",
            "project",
            "title",
            "status",
            "messages",
            "active_run",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_active_run(self, conversation):
        """The run still waiting on a client, so a reload can pick it back up."""
        conversation.runs.expire_stale()
        run = conversation.runs.live().order_by("-created_at").first()
        return AgentRunSerializer(run).data if run else None


def advance_result_to_dict(run: AgentRun, result: AdvanceResult) -> dict:
    return {
        "run_id": str(run.id),
        "status": result.run_status,
        "assistant_text": result.assistant_text,
        "error": run.error,
        "operations": [
            {
                "tool_call_id": operation.tool_call_id,
                "name": operation.name,
                "input": operation.input,
                "risk": operation.risk,
            }
            for operation in result.operations
        ],
    }
