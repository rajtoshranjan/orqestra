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
            ops=[
                OpRequest(
                    tool_call_id="tc_1",
                    name="add_resource",
                    input={"service_id": "lambda"},
                    risk="safe",
                )
            ],
            assistant_text="Adding a Lambda.",
            run_status="awaiting_client",
        )

        payload = advance_result_to_dict(run, result)

        self.assertEqual(payload["run_id"], str(run.id))
        self.assertEqual(payload["status"], "awaiting_client")
        self.assertEqual(payload["assistant_text"], "Adding a Lambda.")
        self.assertEqual(payload["ops"][0]["name"], "add_resource")
        self.assertEqual(payload["ops"][0]["risk"], "safe")
