from django.test import SimpleTestCase

from agent.llm.mappers import to_anthropic_messages, to_anthropic_tools
from agent.llm.types import (
    LLMMessage,
    Role,
    TextBlock,
    ToolCallBlock,
    ToolResultBlock,
    ToolSpec,
)


class MapperTests(SimpleTestCase):
    def test_tools_mapped_to_anthropic_shape(self):
        tools = [ToolSpec(name="add_resource", description="Add a node", input_schema={"type": "object"})]

        result = to_anthropic_tools(tools)

        self.assertEqual(
            result,
            [{"name": "add_resource", "description": "Add a node", "input_schema": {"type": "object"}}],
        )

    def test_assistant_tool_call_maps_to_tool_use(self):
        messages = [
            LLMMessage(role=Role.ASSISTANT, content=[ToolCallBlock(id="tc_1", name="add_resource", input={"x": 1})])
        ]

        result = to_anthropic_messages(messages)

        self.assertEqual(result[0]["role"], "assistant")
        self.assertEqual(result[0]["content"][0]["type"], "tool_use")
        self.assertEqual(result[0]["content"][0]["id"], "tc_1")

    def test_tool_role_maps_to_user_with_tool_result(self):
        messages = [
            LLMMessage(role=Role.TOOL, content=[ToolResultBlock(tool_call_id="tc_1", content="done")])
        ]

        result = to_anthropic_messages(messages)

        self.assertEqual(result[0]["role"], "user")
        self.assertEqual(result[0]["content"][0]["type"], "tool_result")
        self.assertEqual(result[0]["content"][0]["tool_use_id"], "tc_1")
