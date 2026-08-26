import json
from unittest import mock

from agent.llm.mappers import to_ollama_messages, to_ollama_tools
from agent.llm.ollama_provider import OllamaProvider
from agent.llm.types import (
    LLMMessage,
    Role,
    Stop,
    TextBlock,
    TextDelta,
    ToolCallBlock,
    ToolCallRequested,
    ToolResultBlock,
    ToolSpec,
    Usage,
)
from django.test import SimpleTestCase


class _FakeResponse:
    """Stands in for a streaming `requests` response."""

    def __init__(self, chunks, status_code=200, text=""):
        self.status_code = status_code
        self.text = text
        self._lines = [json.dumps(chunk).encode() for chunk in chunks]

    def iter_lines(self):
        yield from self._lines

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def _post_returning(response):
    return mock.patch("requests.post", return_value=response)


class OllamaProviderTests(SimpleTestCase):
    def test_name_and_capabilities(self):
        provider = OllamaProvider(base_url="http://localhost:11434", model="qwen3:8b")

        self.assertEqual(provider.name, "ollama")
        self.assertTrue(provider.capabilities.supports_tools)
        self.assertTrue(provider.capabilities.supports_streaming)

    def test_stream_yields_canonical_events(self):
        chunks = [
            {"message": {"role": "assistant", "content": "Adding "}, "done": False},
            {"message": {"role": "assistant", "content": "a Lambda"}, "done": False},
            {
                "message": {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [
                        {
                            "function": {
                                "name": "add_resource",
                                "arguments": {"service_id": "lambda"},
                            }
                        }
                    ],
                },
                "done": False,
            },
            {
                "message": {"role": "assistant", "content": ""},
                "done": True,
                "done_reason": "stop",
                "prompt_eval_count": 11,
                "eval_count": 7,
            },
        ]
        provider = OllamaProvider(base_url="http://localhost:11434", model="qwen3:8b")

        with _post_returning(_FakeResponse(chunks)):
            events = list(
                provider.stream(
                    system_prompt="system",
                    messages=[
                        LLMMessage(role=Role.USER, content=[TextBlock(text="hello")])
                    ],
                    tools=[
                        ToolSpec(
                            name="add_resource",
                            description="description",
                            input_schema={"type": "object"},
                        )
                    ],
                )
            )

        self.assertEqual(events[0], TextDelta(text="Adding "))
        self.assertEqual(events[1], TextDelta(text="a Lambda"))
        self.assertIn(Usage(input_tokens=11, output_tokens=7), events)
        self.assertIn(Stop(reason="stop"), events)

        calls = [event for event in events if isinstance(event, ToolCallRequested)]
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].name, "add_resource")
        self.assertEqual(calls[0].input, {"service_id": "lambda"})
        # Ollama issues no call id, so the provider must mint one for the engine.
        self.assertTrue(calls[0].id)

    def test_stream_parses_string_encoded_arguments(self):
        chunks = [
            {
                "message": {
                    "content": "",
                    "tool_calls": [
                        {
                            "function": {
                                "name": "configure",
                                "arguments": '{"node_id": "n1"}',
                            }
                        }
                    ],
                },
                "done": True,
            }
        ]
        provider = OllamaProvider(base_url="http://localhost:11434", model="qwen3:8b")

        with _post_returning(_FakeResponse(chunks)):
            events = list(
                provider.stream(system_prompt="s", messages=[], tools=[])
            )

        calls = [event for event in events if isinstance(event, ToolCallRequested)]
        self.assertEqual(calls[0].input, {"node_id": "n1"})

    def test_tool_call_ids_are_unique(self):
        chunks = [
            {
                "message": {
                    "content": "",
                    "tool_calls": [
                        {"function": {"name": "validate", "arguments": {}}},
                        {"function": {"name": "estimate_cost", "arguments": {}}},
                    ],
                },
                "done": True,
            }
        ]
        provider = OllamaProvider(base_url="http://localhost:11434", model="qwen3:8b")

        with _post_returning(_FakeResponse(chunks)):
            events = list(provider.stream(system_prompt="s", messages=[], tools=[]))

        calls = [event for event in events if isinstance(event, ToolCallRequested)]
        self.assertEqual(len({call.id for call in calls}), 2)

    def test_stream_sends_num_ctx_override(self):
        provider = OllamaProvider(base_url="http://localhost:11434", model="qwen3:8b")

        with _post_returning(_FakeResponse([{"done": True}])) as post:
            list(provider.stream(system_prompt="s", messages=[], tools=[]))

        options = post.call_args.kwargs["json"]["options"]
        # Ollama's 4096 default would truncate the catalog out of the prompt.
        self.assertGreater(options["num_ctx"], 4096)

    def test_system_prompt_is_first_message(self):
        provider = OllamaProvider(base_url="http://localhost:11434", model="qwen3:8b")

        with _post_returning(_FakeResponse([{"done": True}])) as post:
            list(
                provider.stream(
                    system_prompt="you are an agent",
                    messages=[
                        LLMMessage(role=Role.USER, content=[TextBlock(text="hi")])
                    ],
                    tools=[],
                )
            )

        sent = post.call_args.kwargs["json"]["messages"]
        self.assertEqual(sent[0], {"role": "system", "content": "you are an agent"})
        self.assertEqual(sent[1], {"role": "user", "content": "hi"})

    def test_error_status_raises(self):
        provider = OllamaProvider(base_url="http://localhost:11434", model="missing")
        response = _FakeResponse([], status_code=404, text='{"error":"model not found"}')

        with _post_returning(response):
            with self.assertRaises(RuntimeError) as context:
                list(provider.stream(system_prompt="s", messages=[], tools=[]))

        self.assertIn("404", str(context.exception))

    def test_model_without_tool_support_gives_actionable_error(self):
        provider = OllamaProvider(base_url="http://localhost:11434", model="llama3")
        response = _FakeResponse(
            [],
            status_code=400,
            text='{"error":"registry.ollama.ai/library/llama3:latest '
            'does not support tools"}',
        )

        with _post_returning(response):
            with self.assertRaises(RuntimeError) as context:
                list(provider.stream(system_prompt="s", messages=[], tools=[]))

        message = str(context.exception)
        self.assertIn("llama3", message)
        self.assertIn("tool-calling", message)
        self.assertIn("AGENT_LLM_MODEL", message)

    def test_connection_error_names_the_url(self):
        import requests

        provider = OllamaProvider(base_url="http://host.docker.internal:11434")

        with mock.patch(
            "requests.post", side_effect=requests.exceptions.ConnectionError()
        ):
            with self.assertRaises(RuntimeError) as context:
                list(provider.stream(system_prompt="s", messages=[], tools=[]))

        self.assertIn("host.docker.internal:11434", str(context.exception))

    def test_to_ollama_tools(self):
        tools = [
            ToolSpec(
                name="add_resource",
                description="Add a resource node",
                input_schema={
                    "type": "object",
                    "properties": {"service_id": {"type": "string"}},
                },
            )
        ]

        ollama_tools = to_ollama_tools(tools)

        self.assertEqual(len(ollama_tools), 1)
        self.assertEqual(ollama_tools[0]["type"], "function")
        function = ollama_tools[0]["function"]
        self.assertEqual(function["name"], "add_resource")
        self.assertEqual(function["description"], "Add a resource node")
        self.assertEqual(function["parameters"], tools[0].input_schema)

    def test_to_ollama_messages(self):
        messages = [
            LLMMessage(
                role=Role.USER, content=[TextBlock(text="Help me configure Lambda")]
            ),
            LLMMessage(
                role=Role.ASSISTANT,
                content=[
                    TextBlock(text="Sure."),
                    ToolCallBlock(
                        id="tc_1", name="add_resource", input={"type": "lambda"}
                    ),
                ],
            ),
            LLMMessage(
                role=Role.TOOL,
                content=[ToolResultBlock(tool_call_id="tc_1", content="success")],
            ),
        ]

        ollama_messages = to_ollama_messages(messages)

        self.assertEqual(len(ollama_messages), 3)

        self.assertEqual(
            ollama_messages[0],
            {"role": "user", "content": "Help me configure Lambda"},
        )

        self.assertEqual(ollama_messages[1]["role"], "assistant")
        self.assertEqual(ollama_messages[1]["content"], "Sure.")
        self.assertEqual(
            ollama_messages[1]["tool_calls"],
            [{"function": {"name": "add_resource", "arguments": {"type": "lambda"}}}],
        )

        # Tool results become their own message, keyed by name rather than id.
        self.assertEqual(
            ollama_messages[2],
            {"role": "tool", "tool_name": "add_resource", "content": "success"},
        )

    def test_to_ollama_messages_skips_empty_turns(self):
        messages = [
            LLMMessage(role=Role.ASSISTANT, content=[]),
            LLMMessage(role=Role.USER, content=[TextBlock(text="hi")]),
        ]

        self.assertEqual(
            to_ollama_messages(messages), [{"role": "user", "content": "hi"}]
        )
