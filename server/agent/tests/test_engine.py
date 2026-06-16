from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project

from accounts.models import User
from agent.constants import (
    AGENT_RUN_COMPLETED,
    AGENT_TOOL_CALL,
    MessageRole,
    RiskLevel,
    RunStatus,
)
from agent.engine import AgentEngine
from agent.llm.types import Stop, TextDelta, ToolCallRequested, Usage
from agent.models import AgentConversation, AgentMessage, AgentRun
from agent.tests.fakes import FakeLLMProvider, RecordingSink

CATALOG = [{"id": "lambda", "name": "AWS Lambda", "category": "compute"}]


class EngineTestBase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(organisation=self.org, name="P", nodes=[], edges=[])
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user
        )
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.USER.value,
            content=[{"type": "text", "text": "Build me a web API."}],
        )
        self.run = AgentRun.objects.create(conversation=self.conversation)


class AdvanceTests(EngineTestBase):
    def test_tool_turn_returns_ops_and_awaits_client(self):
        provider = FakeLLMProvider([
            [
                TextDelta(text="Adding a Lambda."),
                ToolCallRequested(id="tc_1", name="add_resource", input={"service_id": "lambda"}),
                Usage(input_tokens=10, output_tokens=5),
                Stop(reason="tool_use"),
            ]
        ])
        sink = RecordingSink()
        engine = AgentEngine(provider=provider, event_sink=sink)

        result = engine.advance(self.run, op_results=[], catalog=CATALOG)

        self.assertEqual(result.run_status, RunStatus.AWAITING_CLIENT.value)
        self.assertEqual(len(result.ops), 1)
        self.assertEqual(result.ops[0].name, "add_resource")
        self.assertEqual(result.ops[0].risk, RiskLevel.SAFE.value)
        self.assertEqual(result.assistant_text, "Adding a Lambda.")
        self.assertIn(AGENT_TOOL_CALL, [event_type for event_type, _ in sink.events])

    def test_text_only_turn_completes_run(self):
        provider = FakeLLMProvider([
            [TextDelta(text="All done!"), Usage(input_tokens=3, output_tokens=2), Stop(reason="end_turn")]
        ])
        sink = RecordingSink()
        engine = AgentEngine(provider=provider, event_sink=sink)

        result = engine.advance(self.run, op_results=[], catalog=CATALOG)

        self.assertEqual(result.run_status, RunStatus.COMPLETED.value)
        self.assertEqual(result.ops, [])
        self.run.refresh_from_db()
        self.assertEqual(self.run.status, RunStatus.COMPLETED.value)
        self.assertIn(AGENT_RUN_COMPLETED, [event_type for event_type, _ in sink.events])

    def test_persists_assistant_message_with_tokens(self):
        provider = FakeLLMProvider([
            [TextDelta(text="Hi"), Usage(input_tokens=4, output_tokens=1), Stop(reason="end_turn")]
        ])
        engine = AgentEngine(provider=provider)

        engine.advance(self.run, op_results=[], catalog=CATALOG)

        assistant = self.conversation.messages.filter(role=MessageRole.ASSISTANT.value).first()
        self.assertIsNotNone(assistant)
        self.assertEqual(assistant.content[0]["text"], "Hi")
        self.assertEqual(assistant.output_tokens, 1)

    def test_op_results_persisted_as_tool_message(self):
        provider = FakeLLMProvider([
            [TextDelta(text="Done"), Usage(input_tokens=1, output_tokens=1), Stop(reason="end_turn")]
        ])
        engine = AgentEngine(provider=provider)

        engine.advance(
            self.run,
            op_results=[{"tool_call_id": "tc_1", "content": "added node n1", "is_error": False}],
            catalog=CATALOG,
        )

        tool_message = self.conversation.messages.filter(role=MessageRole.TOOL.value).first()
        self.assertIsNotNone(tool_message)
        self.assertEqual(tool_message.content[0]["tool_call_id"], "tc_1")

    def test_max_turns_guard_fails_run(self):
        provider = FakeLLMProvider([])  # never called
        engine = AgentEngine(provider=provider, max_turns=2)
        self.run.turn_count = 2
        self.run.save(update_fields=["turn_count"])

        result = engine.advance(self.run, op_results=[], catalog=CATALOG)

        self.assertEqual(result.run_status, RunStatus.FAILED.value)
        self.run.refresh_from_db()
        self.assertEqual(self.run.status, RunStatus.FAILED.value)
        self.assertTrue(self.run.error)
