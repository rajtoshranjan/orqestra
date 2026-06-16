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
