from rest_framework import serializers

from .engine import AdvanceResult
from .models import AgentConversation, AgentMessage, AgentRun


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


class AgentConversationSerializer(serializers.ModelSerializer):
    catalog = serializers.JSONField(required=False, write_only=True)

    class Meta:
        model = AgentConversation
        fields = [
            "id",
            "project",
            "title",
            "status",
            "catalog",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_at", "updated_at"]


class AgentConversationDetailSerializer(serializers.ModelSerializer):
    messages = AgentMessageSerializer(many=True, read_only=True)

    class Meta:
        model = AgentConversation
        fields = [
            "id",
            "project",
            "title",
            "status",
            "messages",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


def advance_result_to_dict(run: AgentRun, result: AdvanceResult) -> dict:
    return {
        "run_id": str(run.id),
        "status": result.run_status,
        "assistant_text": result.assistant_text,
        "error": run.error,
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
