from django.test import SimpleTestCase

from agent.llm.types import (
    ContentBlock,
    LLMMessage,
    Role,
    TextBlock,
    ToolCallBlock,
    ToolResultBlock,
    content_blocks_to_json,
    json_to_content_blocks,
)


class ContentSerializationTests(SimpleTestCase):
    def test_round_trips_all_block_types(self):
        blocks: list[ContentBlock] = [
            TextBlock(text="hello"),
            ToolCallBlock(id="tc_1", name="add_resource", input={"service_id": "lambda"}),
            ToolResultBlock(tool_call_id="tc_1", content="ok", is_error=False),
        ]

        restored = json_to_content_blocks(content_blocks_to_json(blocks))

        self.assertEqual(restored, blocks)

    def test_message_holds_role_and_blocks(self):
        message = LLMMessage(role=Role.USER, content=[TextBlock(text="hi")])

        self.assertEqual(message.role, Role.USER)
        self.assertEqual(message.content[0].text, "hi")
