from types import SimpleNamespace
from unittest import mock

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
from django.test import SimpleTestCase


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
    content = [
        _FakeBlock(
            type="tool_use",
            id="tc_1",
            name="add_resource",
            input={"service_id": "lambda"},
        )
    ]


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

    def test_sdk_uses_fixed_endpoint_and_refuses_redirects(self):
        with mock.patch("anthropic.Anthropic", return_value=_FakeClient()) as factory:
            list(AnthropicProvider(api_key="secret", model="claude-sonnet-4").stream(
                system_prompt="", messages=[], tools=[],
            ))
        self.assertEqual(factory.call_args.kwargs["base_url"], "https://api.anthropic.com")
        self.assertFalse(factory.call_args.kwargs["http_client"].follow_redirects)
        self.assertEqual(factory.call_args.kwargs["max_retries"], 0)
        factory.call_args.kwargs["http_client"].close()

    def test_missing_tool_ids_are_minted(self):
        client = mock.MagicMock()
        stream = client.messages.stream.return_value.__enter__.return_value
        stream.text_stream = []
        stream.get_final_message.return_value = SimpleNamespace(
            content=[_FakeBlock("tool_use", name="validate"), _FakeBlock("tool_use", name="validate")],
            usage=_FakeUsage(), stop_reason="tool_use",
        )
        events = list(AnthropicProvider(client=client).stream(
            system_prompt="", messages=[], tools=[],
        ))
        calls = [event for event in events if isinstance(event, ToolCallRequested)]
        self.assertEqual(len({call.id for call in calls}), 2)
        self.assertTrue(all(call.id for call in calls))

    def test_stream_yields_canonical_events(self):
        provider = AnthropicProvider(client=_FakeClient(), model="claude-opus-4-8")

        events = list(
            provider.stream(
                system_prompt="sys",
                messages=[LLMMessage(role=Role.USER, content=[TextBlock(text="hi")])],
                tools=[
                    ToolSpec(
                        name="add_resource",
                        description="d",
                        input_schema={"type": "object"},
                    )
                ],
            )
        )

        self.assertEqual(events[0], TextDelta(text="Adding "))
        self.assertEqual(events[1], TextDelta(text="a Lambda"))
        self.assertIn(
            ToolCallRequested(
                id="tc_1", name="add_resource", input={"service_id": "lambda"}
            ),
            events,
        )
        self.assertIn(Usage(input_tokens=11, output_tokens=7), events)
        self.assertIn(Stop(reason="tool_use"), events)
