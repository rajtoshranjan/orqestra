"""Contracts every adapter must satisfy, regardless of vendor.

Tool-call ids and prompt caching are engine-level concerns that each adapter has
historically had to rediscover. These pin them at the seam instead.
"""

from agent.llm.anthropic_provider import AnthropicProvider
from agent.llm.gemini_provider import GeminiProvider
from agent.llm.mappers import ensure_tool_call_id
from agent.llm.types import LLMMessage, Role, TextBlock, ToolSpec
from django.test import SimpleTestCase

TOOLS = [ToolSpec(name="noop", description="", input_schema={"type": "object"})]
MESSAGES = [LLMMessage(role=Role.USER, content=[TextBlock(text="hi")])]


class ToolCallIdTests(SimpleTestCase):
    def test_a_supplied_id_is_kept(self):
        self.assertEqual(ensure_tool_call_id("tc_1"), "tc_1")

    def test_a_missing_id_is_minted_uniquely(self):
        """Providers that issue no id must not collide: the engine pairs by id."""
        first = ensure_tool_call_id(None)
        second = ensure_tool_call_id("")

        self.assertTrue(first)
        self.assertTrue(second)
        self.assertNotEqual(first, second)


# --- Gemini ---------------------------------------------------------------


class _FakeCall:
    def __init__(self, id, name, args):
        self.id = id
        self.name = name
        self.args = args


class _FakeChunk:
    text = None
    usage_metadata = None
    candidates = None

    def __init__(self, function_calls):
        self.function_calls = function_calls


class _FakeModels:
    def __init__(self, chunks):
        self._chunks = chunks
        self.kwargs = None

    def generate_content_stream(self, **kwargs):
        self.kwargs = kwargs
        return iter(self._chunks)


class _FakeGeminiClient:
    def __init__(self, chunks):
        self.models = _FakeModels(chunks)


class GeminiToolCallIdTests(SimpleTestCase):
    def test_parallel_calls_without_ids_do_not_collide(self):
        """Gemini returns id=None; two calls in a turn must stay distinguishable."""
        chunks = [
            _FakeChunk(
                [
                    _FakeCall(None, "add_resource", {"service_id": "lambda"}),
                    _FakeCall(None, "add_resource", {"service_id": "s3"}),
                ]
            )
        ]
        provider = GeminiProvider(
            client=_FakeGeminiClient(chunks), model="gemini-2.5-flash"
        )

        events = list(
            provider.stream(system_prompt="s", messages=MESSAGES, tools=TOOLS)
        )
        ids = [event.id for event in events if getattr(event, "name", None)]

        self.assertEqual(len(ids), 2)
        self.assertTrue(all(ids))
        self.assertEqual(len(set(ids)), 2)


# --- Anthropic ------------------------------------------------------------


class _FakeUsage:
    input_tokens = 11
    output_tokens = 7


class _FakeFinal:
    stop_reason = "end_turn"
    usage = _FakeUsage()
    content = []


class _FakeStreamContext:
    text_stream = ["ok"]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def get_final_message(self):
        return _FakeFinal()


class _RecordingMessages:
    def __init__(self):
        self.kwargs = None

    def stream(self, **kwargs):
        self.kwargs = kwargs
        return _FakeStreamContext()


class _RecordingClient:
    def __init__(self):
        self.messages = _RecordingMessages()


class AnthropicCachingTests(SimpleTestCase):
    def test_a_stable_prefix_is_sent_as_a_cached_system_block(self):
        """The catalog is byte-identical every turn; paying for it each time is waste."""
        client = _RecordingClient()
        provider = AnthropicProvider(client=client, model="claude-sonnet-5")

        list(
            provider.stream(
                system_prompt="CATALOG\n\nCANVAS",
                cacheable_prefix="CATALOG",
                messages=MESSAGES,
                tools=TOOLS,
            )
        )

        system = client.messages.kwargs["system"]
        self.assertIsInstance(system, list)
        self.assertEqual(system[0]["text"], "CATALOG")
        self.assertEqual(system[0]["cache_control"], {"type": "ephemeral"})
        self.assertNotIn("cache_control", system[1])

    def test_without_a_prefix_the_system_prompt_stays_a_plain_string(self):
        client = _RecordingClient()
        provider = AnthropicProvider(client=client, model="claude-sonnet-5")

        list(
            provider.stream(system_prompt="whole thing", messages=MESSAGES, tools=TOOLS)
        )

        self.assertEqual(client.messages.kwargs["system"], "whole thing")

    def test_max_tokens_is_passed_through_to_the_vendor_call(self):
        client = _RecordingClient()
        provider = AnthropicProvider(client=client, model="claude-sonnet-5")

        list(
            provider.stream(
                system_prompt="s", messages=MESSAGES, tools=TOOLS, max_tokens=8192
            )
        )

        self.assertEqual(client.messages.kwargs["max_tokens"], 8192)
