from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project

from accounts.models import User
from agent.constants import MessageRole, RunStatus
from agent.models import AgentConversation, AgentMessage, AgentRun


class AgentModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(organisation=self.org, name="P")
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user
        )

    def test_conversation_defaults_active(self):
        self.assertEqual(self.conversation.status, "active")

    def test_message_belongs_to_conversation_and_orders_by_created(self):
        first = AgentMessage.objects.create(
            conversation=self.conversation, role=MessageRole.USER.value, content=[]
        )
        second = AgentMessage.objects.create(
            conversation=self.conversation, role=MessageRole.ASSISTANT.value, content=[]
        )

        self.assertEqual(list(self.conversation.messages.all()), [first, second])

    def test_run_defaults_running_and_zero_counters(self):
        run = AgentRun.objects.create(conversation=self.conversation)

        self.assertEqual(run.status, RunStatus.RUNNING.value)
        self.assertEqual(run.turn_count, 0)
        self.assertEqual(run.input_tokens, 0)
