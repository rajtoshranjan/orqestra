"""Grounding and round-trip economy.

The catalog is shipped to the server once and stored; the graph arrives with
every request. Anything the model asks for that is already here must be answered
here — a lookup should never cost an HTTP round trip plus a whole model turn.
"""

from accounts.models import User
from agent.constants import MessageRole, RunStatus
from agent.engine import AgentEngine, _budget_history
from agent.llm.types import (
    LLMMessage,
    Role,
    Stop,
    TextBlock,
    TextDelta,
    ToolCallRequested,
    Usage,
    content_blocks_to_json,
)
from agent.models import AgentConversation, AgentMessage, AgentRun
from agent.prompts import build_system_prompt
from agent.tests.fakes import FakeLLMProvider
from agent.tools import CLIENT_OP_NAMES, SERVER_RESOLVED_OPS, resolve_read_op
from django.test import TestCase
from organisations.models import Organisation
from projects.models import Project

RICH_CATALOG = [
    {
        "id": "lambda",
        "name": "AWS Lambda",
        "category": "compute",
        "capabilities": {"provides": ["compute"], "requires": ["execution-role"]},
        "allowedParents": ["vpc", "subnet"],
        "allowedRelationships": ["sqs", "dynamodb"],
        "summary": "Serverless function for event-driven work.",
    },
    {
        "id": "vpc",
        "name": "AWS VPC",
        "category": "networking",
        "isContainer": True,
        "summary": "Private network boundary.",
    },
]


class SystemPromptGroundingTests(TestCase):
    def test_prompt_carries_capabilities_parents_and_relationships(self):
        """Selection is by capability, so the prompt has to show capabilities."""
        prompt = build_system_prompt(RICH_CATALOG, [], [])

        self.assertIn("execution-role", prompt)
        self.assertIn("compute", prompt)
        self.assertIn("vpc", prompt)
        self.assertIn("sqs", prompt)
        self.assertIn("Serverless function for event-driven work.", prompt)

    def test_prompt_marks_container_services(self):
        prompt = build_system_prompt(RICH_CATALOG, [], [])
        self.assertIn("container", prompt)

    def test_prompt_does_not_mandate_a_redundant_query_graph_call(self):
        """The canvas section already lists every node id; re-reading is a wasted turn."""
        prompt = build_system_prompt(
            RICH_CATALOG,
            [{"id": "n1", "data": {"service_id": "lambda", "label": "API"}}],
            [],
        )

        self.assertNotIn("FIRST call `query_graph`", prompt)
        self.assertIn("n1", prompt)


class ReadResolutionTests(TestCase):
    def test_list_services_is_answered_from_the_stored_catalog(self):
        content, is_error = resolve_read_op("list_services", {}, RICH_CATALOG, [], [])

        self.assertFalse(is_error)
        self.assertIn("lambda", content)
        self.assertIn("vpc", content)

    def test_list_services_with_an_unmatched_category_still_returns_content(self):
        """An empty tool result is rejected by every provider."""
        content, is_error = resolve_read_op(
            "list_services", {"category": "quantum"}, RICH_CATALOG, [], []
        )

        self.assertTrue(content.strip())
        self.assertIn("quantum", content)

    def test_get_service_returns_the_full_entry(self):
        content, is_error = resolve_read_op(
            "get_service", {"service_id": "lambda"}, RICH_CATALOG, [], []
        )

        self.assertFalse(is_error)
        self.assertIn("execution-role", content)

    def test_get_service_reports_an_unknown_id_as_an_error(self):
        content, is_error = resolve_read_op(
            "get_service", {"service_id": "nope"}, RICH_CATALOG, [], []
        )

        self.assertTrue(is_error)
        self.assertIn("nope", content)

    def test_query_graph_reads_the_posted_snapshot(self):
        content, is_error = resolve_read_op(
            "query_graph",
            {},
            RICH_CATALOG,
            [{"id": "n1", "data": {"service_id": "lambda", "label": "API"}}],
            [{"id": "e1", "source": "n1", "target": "n2"}],
        )

        self.assertFalse(is_error)
        self.assertIn("n1", content)
        self.assertIn("e1", content)

    def test_mutations_are_not_server_resolvable(self):
        for op in ("add_resource", "connect", "configure", "set_parent", "remove"):
            self.assertNotIn(op, SERVER_RESOLVED_OPS)

    def test_validate_and_estimate_cost_stay_on_the_client(self):
        self.assertIn("validate", CLIENT_OP_NAMES)
        self.assertIn("estimate_cost", CLIENT_OP_NAMES)


class ServerLoopTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(
            organisation=self.org, name="P", nodes=[], edges=[]
        )
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user, catalog=RICH_CATALOG
        )
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.USER.value,
            content=content_blocks_to_json([TextBlock(text="Add a function.")]),
        )
        self.run = AgentRun.objects.create(conversation=self.conversation)

    def test_a_read_only_turn_never_returns_to_the_client(self):
        """list_services then add_resource should be one request, not two."""
        provider = FakeLLMProvider(
            [
                [
                    ToolCallRequested(id="tc_1", name="list_services", input={}),
                    Usage(input_tokens=10, output_tokens=5),
                    Stop(reason="tool_use"),
                ],
                [
                    TextDelta(text="Adding a Lambda."),
                    ToolCallRequested(
                        id="tc_2", name="add_resource", input={"service_id": "lambda"}
                    ),
                    Usage(input_tokens=12, output_tokens=6),
                    Stop(reason="tool_use"),
                ],
            ]
        )

        result = AgentEngine(provider=provider).advance(
            self.run, op_results=[], catalog=RICH_CATALOG, graph=None
        )

        self.assertEqual(len(provider.calls), 2)
        self.assertEqual([op.name for op in result.ops], ["add_resource"])
        self.assertEqual(result.run_status, RunStatus.AWAITING_CLIENT.value)

    def test_narration_from_server_resolved_turns_reaches_the_client(self):
        provider = FakeLLMProvider(
            [
                [
                    TextDelta(text="Let me look at the catalog. "),
                    ToolCallRequested(id="tc_1", name="query_graph", input={}),
                    Usage(input_tokens=1, output_tokens=1),
                    Stop(reason="tool_use"),
                ],
                [
                    TextDelta(text="The canvas is empty, so I'll start fresh."),
                    Usage(input_tokens=1, output_tokens=1),
                    Stop(reason="end_turn"),
                ],
            ]
        )

        result = AgentEngine(provider=provider).advance(
            self.run, op_results=[], catalog=RICH_CATALOG, graph=None
        )

        self.assertIn("Let me look at the catalog.", result.assistant_text)
        self.assertIn("start fresh", result.assistant_text)

    def test_mixed_turn_stashes_server_results_and_merges_them_on_advance(self):
        """Reads answered here must still appear in the TOOL message with the
        client's results, or the turn has an unanswered tool call."""
        provider = FakeLLMProvider(
            [
                [
                    ToolCallRequested(id="tc_read", name="query_graph", input={}),
                    ToolCallRequested(
                        id="tc_add", name="add_resource", input={"service_id": "lambda"}
                    ),
                    Usage(input_tokens=1, output_tokens=1),
                    Stop(reason="tool_use"),
                ],
                [
                    TextDelta(text="Done."),
                    Usage(input_tokens=1, output_tokens=1),
                    Stop(reason="end_turn"),
                ],
            ]
        )
        engine = AgentEngine(provider=provider)

        first = engine.advance(
            self.run, op_results=[], catalog=RICH_CATALOG, graph=None
        )
        self.assertEqual([op.tool_call_id for op in first.ops], ["tc_add"])
        self.run.refresh_from_db()
        self.assertEqual(
            [item["tool_call_id"] for item in self.run.resolved_results], ["tc_read"]
        )

        engine.advance(
            self.run,
            op_results=[
                {"tool_call_id": "tc_add", "content": "added n1", "is_error": False}
            ],
            catalog=RICH_CATALOG,
            graph=None,
        )

        tool_message = AgentMessage.objects.get(
            conversation=self.conversation, role=MessageRole.TOOL.value
        )
        self.assertEqual(
            sorted(block["tool_call_id"] for block in tool_message.content),
            ["tc_add", "tc_read"],
        )
        self.run.refresh_from_db()
        self.assertEqual(self.run.resolved_results, [])


class HistoryBudgetTests(TestCase):
    def _message(self, text):
        return LLMMessage(role=Role.USER, content=[TextBlock(text=text)])

    def test_history_within_budget_is_returned_untouched(self):
        history = [self._message("short")] * 3
        self.assertEqual(len(_budget_history(history, 10_000)), 3)

    def test_oversized_history_keeps_the_opening_request_and_recent_turns(self):
        history = [self._message("first request")] + [
            self._message("x" * 4000) for _ in range(10)
        ]

        budgeted = _budget_history(history, 2000)

        self.assertLess(len(budgeted), len(history))
        self.assertEqual(budgeted[0].content[0].text, "first request")
        self.assertIs(budgeted[-1], history[-1])


class BroadcastEconomyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="b@example.com", password="TestPassword123!", name="B"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(
            organisation=self.org, name="P", nodes=[], edges=[]
        )
        self.conversation = AgentConversation.objects.create(
            project=self.project, created_by=self.user, catalog=[]
        )
        AgentMessage.objects.create(
            conversation=self.conversation,
            role=MessageRole.USER.value,
            content=content_blocks_to_json([TextBlock(text="hi")]),
        )
        self.run = AgentRun.objects.create(conversation=self.conversation)

    def test_one_message_event_per_turn_not_one_per_token(self):
        """A delta-rate broadcast is a channel-layer round trip per token."""
        from agent.constants import AGENT_MESSAGE
        from agent.tests.fakes import RecordingSink

        provider = FakeLLMProvider(
            [
                [
                    TextDelta(text="Adding "),
                    TextDelta(text="a "),
                    TextDelta(text="Lambda."),
                    Usage(input_tokens=1, output_tokens=3),
                    Stop(reason="end_turn"),
                ]
            ]
        )
        sink = RecordingSink()

        AgentEngine(provider=provider, event_sink=sink).advance(
            self.run, op_results=[], catalog=[], graph=None
        )

        messages = [event for event in sink.events if event[0] == AGENT_MESSAGE]
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0][1]["text"], "Adding a Lambda.")
