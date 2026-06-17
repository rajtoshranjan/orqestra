from unittest.mock import patch

from accounts.models import User
from agent.constants import MessageRole, RunStatus
from agent.llm.types import Stop, TextDelta, ToolCallRequested, Usage
from agent.models import AgentConversation, AgentMessage, AgentRun
from agent.tests.fakes import FakeLLMProvider
from django.test import override_settings
from django.urls import reverse
from organisations.models import Organisation
from orqestra.tests import BaseTestCase
from projects.models import Project
from rest_framework import status


@override_settings(
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
)
class ConversationApiTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation, name="P", nodes=[], edges=[]
        )

    def test_create_conversation_stores_catalog_and_creator(self):
        response = self.client.post(
            reverse("agent-conversation-list"),
            {
                "project": str(self.project.id),
                "catalog": [
                    {"id": "lambda", "name": "AWS Lambda", "category": "compute"}
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        conversation = AgentConversation.objects.get()
        self.assertEqual(conversation.catalog[0]["id"], "lambda")
        self.assertEqual(conversation.created_by, self.user)

    def test_create_rejects_project_from_other_org(self):
        other_user = User.objects.create_user(
            email="o@example.com", password="TestPassword123!", name="O"
        )
        other_org = Organisation.objects.create(name="Other", owner=other_user)
        other_project = Project.objects.create(organisation=other_org, name="X")

        response = self.client.post(
            reverse("agent-conversation-list"),
            {"project": str(other_project.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_returns_nested_messages(self):
        conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user
        )

        response = self.client.get(
            reverse("agent-conversation-detail", args=[conversation.id])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("messages", response.data)

    def test_list_scoped_to_active_org(self):
        AgentConversation.objects.create(project=self.project, created_by=self.user)
        other_user = User.objects.create_user(
            email="o@example.com", password="TestPassword123!", name="O"
        )
        other_org = Organisation.objects.create(name="Other", owner=other_user)
        other_project = Project.objects.create(organisation=other_org, name="X")
        AgentConversation.objects.create(project=other_project, created_by=other_user)

        response = self.client.get(reverse("agent-conversation-list"))

        self.assertEqual(len(response.data), 1)


@override_settings(
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
)
class SendActionTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation, name="P", nodes=[], edges=[]
        )
        self.conversation = AgentConversation.objects.create(
            project=self.project,
            created_by=self.user,
            catalog=[{"id": "lambda", "name": "AWS Lambda", "category": "compute"}],
        )

    @patch("agent.views.get_active_provider")
    def test_send_runs_first_turn_and_returns_ops(self, mock_get_provider):
        mock_get_provider.return_value = FakeLLMProvider(
            [
                [
                    TextDelta(text="Adding a Lambda."),
                    ToolCallRequested(
                        id="tc_1", name="add_resource", input={"service_id": "lambda"}
                    ),
                    Usage(input_tokens=10, output_tokens=4),
                    Stop(reason="tool_use"),
                ]
            ]
        )

        response = self.client.post(
            reverse("agent-conversation-send", args=[self.conversation.id]),
            {"message": "Build me a web API."},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], RunStatus.AWAITING_CLIENT.value)
        self.assertEqual(response.data["ops"][0]["name"], "add_resource")
        self.assertEqual(response.data["ops"][0]["risk"], "safe")
        self.assertEqual(
            self.conversation.messages.filter(role=MessageRole.USER.value).count(), 1
        )

    def test_send_requires_message(self):
        response = self.client.post(
            reverse("agent-conversation-send", args=[self.conversation.id]),
            {"message": "  "},
            format="json",
        )

        self.assertEqual(response.status_code, 400)


@override_settings(
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
)
class AdvanceActionTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation, name="P", nodes=[], edges=[]
        )
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user, catalog=[]
        )
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.USER.value,
            content=[{"type": "text", "text": "Add a lambda."}],
        )
        self.run = AgentRun.objects.create(conversation=self.conversation)

    @patch("agent.views.get_active_provider")
    def test_advance_with_op_results_completes_run(self, mock_get_provider):
        mock_get_provider.return_value = FakeLLMProvider(
            [
                [
                    TextDelta(text="Done."),
                    Usage(input_tokens=3, output_tokens=1),
                    Stop(reason="end_turn"),
                ]
            ]
        )

        response = self.client.post(
            reverse("agent-run-advance", args=[self.run.id]),
            {
                "op_results": [
                    {
                        "tool_call_id": "tc_1",
                        "content": "node n1 added",
                        "is_error": False,
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], RunStatus.COMPLETED.value)
        self.assertEqual(response.data["ops"], [])
        self.assertEqual(
            self.conversation.messages.filter(role=MessageRole.TOOL.value).count(), 1
        )

    def test_advance_rejects_non_list_op_results(self):
        response = self.client.post(
            reverse("agent-run-advance", args=[self.run.id]),
            {"op_results": "nope"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_advance_run_from_other_org_is_not_found(self):
        other_user = User.objects.create_user(
            email="o@example.com", password="TestPassword123!", name="O"
        )
        other_org = Organisation.objects.create(name="Other", owner=other_user)
        other_project = Project.objects.create(organisation=other_org, name="X")
        other_conversation = AgentConversation.objects.create(
            project=other_project, created_by=other_user
        )
        other_run = AgentRun.objects.create(conversation=other_conversation)

        response = self.client.post(
            reverse("agent-run-advance", args=[other_run.id]),
            {"op_results": []},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
