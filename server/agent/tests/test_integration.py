from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project

from accounts.models import User
from agent.constants import MessageRole, RunStatus
from agent.engine import AgentEngine
from agent.llm.types import Stop, TextDelta, ToolCallRequested, Usage
from agent.models import AgentConversation, AgentMessage, AgentRun
from agent.tests.fakes import FakeLLMProvider, RecordingSink

CATALOG = [{"id": "lambda", "name": "AWS Lambda", "category": "compute"}]


class IntegrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(organisation=self.org, name="P", nodes=[], edges=[])
        self.conversation = AgentConversation.objects.create(project=self.project, created_by=self.user)
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.USER.value,
            content=[{"type": "text", "text": "Add a lambda."}],
        )
        self.run = AgentRun.objects.create(conversation=self.conversation)

    def test_two_turn_loop_builds_and_completes(self):
        provider = FakeLLMProvider([
            # Turn 1: ask to add a Lambda.
            [
                TextDelta(text="Adding a Lambda."),
                ToolCallRequested(id="tc_1", name="add_resource", input={"service_id": "lambda"}),
                Usage(input_tokens=20, output_tokens=8),
                Stop(reason="tool_use"),
            ],
            # Turn 2: after the client reports success, finish.
            [
                TextDelta(text="Your Lambda is ready."),
                Usage(input_tokens=25, output_tokens=6),
                Stop(reason="end_turn"),
            ],
        ])
        sink = RecordingSink()
        engine = AgentEngine(provider=provider, event_sink=sink)

        first = engine.advance(self.run, op_results=[], catalog=CATALOG)
        self.assertEqual(first.run_status, RunStatus.AWAITING_CLIENT.value)
        self.assertEqual(first.ops[0].name, "add_resource")

        # Simulate the client applying the op and reporting back.
        second = engine.advance(
            self.run,
            op_results=[{"tool_call_id": "tc_1", "content": "node n1 added; validate: ok", "is_error": False}],
            catalog=CATALOG,
        )

        self.assertEqual(second.run_status, RunStatus.COMPLETED.value)
        self.run.refresh_from_db()
        self.assertEqual(self.run.turn_count, 2)
        self.assertEqual(self.run.input_tokens, 45)
        # user + assistant(turn1) + tool + assistant(turn2)
        self.assertEqual(self.conversation.messages.count(), 4)
