from django.test import SimpleTestCase

from agent.llm.anthropic_provider import AnthropicProvider
from agent.llm.types import (
    LLMMessage,
    Role,
    Stop,
    TextBlock,
    TextDelta,
    ToolCallRequested,
    ToolSpec,
    Usage,
)


class _FakeBlock:
    def __init__(self, type, id=None, name=None, input=None):
        self.type = type
        self.id = id
        self.name = name
        self.input = input or {}


class _FakeUsage:
    input_tokens = 11
    output_tokens = 7


class _FakeFinalMessage:
    stop_reason = "tool_use"
    usage = _FakeUsage()
    content = [_FakeBlock(type="tool_use", id="tc_1", name="add_resource", input={"service_id": "lambda"})]


class _FakeStreamContext:
    text_stream = ["Adding ", "a Lambda"]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def get_final_message(self):
        return _FakeFinalMessage()


class _FakeMessages:
    def stream(self, **kwargs):
        return _FakeStreamContext()


class _FakeClient:
    messages = _FakeMessages()


class AnthropicProviderTests(SimpleTestCase):
    def test_name_and_capabilities(self):
        provider = AnthropicProvider(client=_FakeClient(), model="claude-opus-4-8")

        self.assertEqual(provider.name, "anthropic")
        self.assertTrue(provider.capabilities.supports_tools)

    def test_stream_yields_canonical_events(self):
        provider = AnthropicProvider(client=_FakeClient(), model="claude-opus-4-8")

        events = list(
            provider.stream(
                system_prompt="sys",
                messages=[LLMMessage(role=Role.USER, content=[TextBlock(text="hi")])],
                tools=[ToolSpec(name="add_resource", description="d", input_schema={"type": "object"})],
            )
        )

        self.assertEqual(events[0], TextDelta(text="Adding "))
        self.assertEqual(events[1], TextDelta(text="a Lambda"))
        self.assertIn(ToolCallRequested(id="tc_1", name="add_resource", input={"service_id": "lambda"}), events)
        self.assertIn(Usage(input_tokens=11, output_tokens=7), events)
        self.assertIn(Stop(reason="tool_use"), events)
