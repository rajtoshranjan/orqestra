"""Run state machine: status guards, result filtering, cancellation, truncation.

These cover the invariants that keep a conversation replayable — an empty
assistant turn, a duplicated `advance`, or a truncated model response must never
leave history in a shape the provider will reject on the next turn.
"""

from accounts.models import User
from agent.constants import MessageRole, RunStatus
from agent.engine import AgentEngine
from agent.llm.types import (
    LLMMessage,
    Role,
    Stop,
    TextBlock,
    TextDelta,
    ToolCallBlock,
    ToolResultBlock,
    Usage,
    content_blocks_to_json,
)
from agent.models import AgentConversation, AgentMessage, AgentRun
from agent.tests.fakes import FakeLLMProvider
from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project


class LifecycleTestBase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(
            organisation=self.org, name="P", nodes=[], edges=[]
        )
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user
        )
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.USER.value,
            content=content_blocks_to_json([TextBlock(text="Build me a web API.")]),
        )
        self.run = AgentRun.objects.create(conversation=self.conversation)


class EmptyTurnTests(LifecycleTestBase):
    def test_empty_turn_fails_the_run_instead_of_persisting_an_empty_message(self):
        """A turn with no text and no tool calls must not write content=[].

        Replaying `{"role": "assistant", "content": []}` is rejected by every
        provider, and no repair path removes it, so the conversation is dead.
        """
        provider = FakeLLMProvider([[Usage(input_tokens=5, output_tokens=0)]])

        result = AgentEngine(provider=provider).advance(
            self.run, operation_results=[], catalog=[], graph=None
        )

        self.assertEqual(result.run_status, RunStatus.FAILED.value)
        self.assertEqual(
            AgentMessage.objects.filter(
                conversation=self.conversation, role=MessageRole.ASSISTANT.value
            ).count(),
            0,
        )

    def test_repair_history_drops_messages_left_with_no_content(self):
        """Conversations already poisoned by an empty message must heal on load."""
        from agent.engine import _repair_history

        history = [
            LLMMessage(role=Role.USER, content=[TextBlock(text="hi")]),
            LLMMessage(role=Role.ASSISTANT, content=[]),
        ]

        repaired = _repair_history(history)

        self.assertEqual(len(repaired), 1)
        self.assertEqual(repaired[0].role, Role.USER)


class TruncationTests(LifecycleTestBase):
    def test_turn_truncated_at_max_tokens_fails_rather_than_completing(self):
        """`stop_reason: max_tokens` means the plan was cut off mid-thought."""
        provider = FakeLLMProvider(
            [
                [
                    TextDelta(text="Adding a Lambda and then"),
                    Usage(input_tokens=10, output_tokens=4096),
                    Stop(reason="max_tokens"),
                ]
            ]
        )

        result = AgentEngine(provider=provider).advance(
            self.run, operation_results=[], catalog=[], graph=None
        )

        self.assertEqual(result.run_status, RunStatus.FAILED.value)
        self.run.refresh_from_db()
        self.assertIn("truncated", self.run.error.lower())


class OutstandingToolCallTests(LifecycleTestBase):
    def test_outstanding_ids_are_calls_without_results(self):
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.ASSISTANT.value,
            content=content_blocks_to_json(
                [
                    ToolCallBlock(id="tc_1", name="add_resource", input={}),
                    ToolCallBlock(id="tc_2", name="connect", input={}),
                ]
            ),
        )
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.TOOL.value,
            content=content_blocks_to_json(
                [ToolResultBlock(tool_call_id="tc_1", content="ok")]
            ),
        )

        self.assertEqual(self.run.outstanding_tool_call_ids(), {"tc_2"})

    def test_no_outstanding_ids_when_every_call_is_answered(self):
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.ASSISTANT.value,
            content=content_blocks_to_json(
                [ToolCallBlock(id="tc_1", name="validate", input={})]
            ),
        )
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.TOOL.value,
            content=content_blocks_to_json(
                [ToolResultBlock(tool_call_id="tc_1", content="ok")]
            ),
        )

        self.assertEqual(self.run.outstanding_tool_call_ids(), set())


class RunStatusTransitionTests(LifecycleTestBase):
    def test_terminal_runs_are_not_advanceable(self):
        for status in (
            RunStatus.COMPLETED.value,
            RunStatus.FAILED.value,
            RunStatus.CANCELLED.value,
        ):
            with self.subTest(status=status):
                run = AgentRun.objects.create(
                    conversation=self.conversation, status=status
                )
                self.assertFalse(run.is_advanceable)

    def test_awaiting_client_run_is_advanceable(self):
        run = AgentRun.objects.create(
            conversation=self.conversation, status=RunStatus.AWAITING_CLIENT.value
        )
        self.assertTrue(run.is_advanceable)


class CancellationTests(LifecycleTestBase):
    def test_cancelled_run_stops_the_loop_before_calling_the_provider(self):
        self.run.status = RunStatus.CANCELLED.value
        self.run.save(update_fields=["status"])
        provider = FakeLLMProvider([[TextDelta(text="should never run")]])

        result = AgentEngine(provider=provider).advance(
            self.run, operation_results=[], catalog=[], graph=None
        )

        self.assertEqual(result.run_status, RunStatus.CANCELLED.value)
        self.assertEqual(provider.calls, [])


class OutstandingOperationTests(LifecycleTestBase):
    def test_outstanding_operations_carry_input_and_risk(self):
        """A thread or a reloaded panel has to know what it is being asked to approve."""
        AgentMessage.objects.create(
            conversation=self.conversation,
            run=self.run,
            role=MessageRole.ASSISTANT.value,
            content=content_blocks_to_json(
                [
                    ToolCallBlock(id="tc_1", name="remove", input={"target_id": "n1"}),
                    ToolCallBlock(
                        id="tc_2",
                        name="add_resource",
                        input={"service_id": "lambda"},
                    ),
                ]
            ),
        )
        AgentMessage.objects.create(
            conversation=self.conversation,
            run=self.run,
            role=MessageRole.TOOL.value,
            content=content_blocks_to_json(
                [ToolResultBlock(tool_call_id="tc_2", content="added")]
            ),
        )

        operations = self.run.outstanding_operations()

        self.assertEqual(len(operations), 1)
        self.assertEqual(operations[0]["tool_call_id"], "tc_1")
        self.assertEqual(operations[0]["name"], "remove")
        self.assertEqual(operations[0]["input"], {"target_id": "n1"})
        self.assertEqual(operations[0]["risk"], "confirm")

    def test_no_outstanding_operations_when_everything_is_answered(self):
        self.assertEqual(self.run.outstanding_operations(), [])
