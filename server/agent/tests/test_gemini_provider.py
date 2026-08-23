from agent.llm.gemini_provider import GeminiProvider
from agent.llm.mappers import to_gemini_messages, to_gemini_tools
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
from google.genai import types


class _FakeFunctionCall:
    def __init__(self, id, name, args):
        self.id = id
        self.name = name
        self.args = args


class _FakeUsageMetadata:
    def __init__(self, prompt_token_count, candidates_token_count):
        self.prompt_token_count = prompt_token_count
        self.candidates_token_count = candidates_token_count


class _FakeFinishReason:
    def __init__(self, name):
        self.name = name

    def __str__(self):
        return self.name


class _FakeCandidate:
    def __init__(self, finish_reason):
        self.finish_reason = finish_reason


class _FakeChunk:
    def __init__(self, text=None, function_calls=None, usage_metadata=None, candidates=None):
        self._text = text
        self.function_calls = function_calls
        self.usage_metadata = usage_metadata
        self.candidates = candidates

    @property
    def text(self):
        if self._text is None:
            raise ValueError("No text in this chunk")
        return self._text


class _FakeModels:
    def __init__(self, chunks):
        self.chunks = chunks

    def generate_content_stream(self, model, contents, config):
        return self.chunks


class _FakeClient:
    def __init__(self, chunks):
        self.models = _FakeModels(chunks)


class GeminiProviderTests(SimpleTestCase):
    def test_name_and_capabilities(self):
        provider = GeminiProvider(client=_FakeClient([]), model="gemini-2.5-flash")

        self.assertEqual(provider.name, "gemini")
        self.assertTrue(provider.capabilities.supports_tools)
        self.assertTrue(provider.capabilities.supports_streaming)

    def test_stream_yields_canonical_events(self):
        chunks = [
            _FakeChunk(text="Adding "),
            _FakeChunk(
                text="a Lambda",
                function_calls=[
                    _FakeFunctionCall(
                        id="tc_1",
                        name="add_resource",
                        args={"service_id": "lambda"},
                    )
                ],
            ),
            _FakeChunk(
                usage_metadata=_FakeUsageMetadata(11, 7),
                candidates=[_FakeCandidate(_FakeFinishReason("STOP"))],
            ),
        ]
        provider = GeminiProvider(client=_FakeClient(chunks), model="gemini-2.5-flash")

        events = list(
            provider.stream(
                system_prompt="system",
                messages=[LLMMessage(role=Role.USER, content=[TextBlock(text="hello")])],
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
        self.assertIn(
            ToolCallRequested(
                id="tc_1", name="add_resource", input={"service_id": "lambda"}
            ),
            events,
        )
        self.assertIn(Usage(input_tokens=11, output_tokens=7), events)
        self.assertIn(Stop(reason="stop"), events)

    def test_to_gemini_tools(self):
        tools = [
            ToolSpec(
                name="add_resource",
                description="Add a resource node",
                input_schema={
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "parent_id": {"type": ["string", "null"]},
                    },
                },
            )
        ]
        gemini_tools = to_gemini_tools(tools)

        self.assertEqual(len(gemini_tools), 1)
        self.assertIsInstance(gemini_tools[0], types.Tool)
        self.assertEqual(len(gemini_tools[0].function_declarations), 1)
        decl = gemini_tools[0].function_declarations[0]
        self.assertEqual(decl.name, "add_resource")
        self.assertEqual(decl.description, "Add a resource node")
        dumped = decl.parameters.model_dump(mode='json', exclude_none=True)
        self.assertEqual(dumped.get("type").upper(), "OBJECT")
        self.assertEqual(dumped.get("properties", {}).get("type", {}).get("type").upper(), "STRING")
        self.assertEqual(dumped.get("properties", {}).get("parent_id", {}).get("type").upper(), "STRING")

    def test_to_gemini_messages(self):
        messages = [
            LLMMessage(
                role=Role.USER,
                content=[TextBlock(text="Help me configure Lambda")],
            ),
            LLMMessage(
                role=Role.ASSISTANT,
                content=[ToolCallBlock(id="tc_1", name="add_resource", input={"type": "lambda"})],
            ),
            LLMMessage(
                role=Role.TOOL,
                content=[ToolResultBlock(tool_call_id="tc_1", content="success")],
            ),
        ]

        gemini_messages = to_gemini_messages(messages)

        self.assertEqual(len(gemini_messages), 3)

        # Verify user message.
        self.assertEqual(gemini_messages[0].role, "user")
        self.assertEqual(len(gemini_messages[0].parts), 1)
        self.assertEqual(gemini_messages[0].parts[0].text, "Help me configure Lambda")

        # Verify assistant / model message.
        self.assertEqual(gemini_messages[1].role, "model")
        self.assertEqual(len(gemini_messages[1].parts), 1)
        self.assertEqual(gemini_messages[1].parts[0].function_call.name, "add_resource")
        self.assertEqual(gemini_messages[1].parts[0].function_call.args, {"type": "lambda"})
        self.assertEqual(gemini_messages[1].parts[0].function_call.id, "tc_1")

        # Verify tool response message.
        self.assertEqual(gemini_messages[2].role, "tool")
        self.assertEqual(len(gemini_messages[2].parts), 1)
        self.assertEqual(gemini_messages[2].parts[0].function_response.name, "add_resource")
        self.assertEqual(gemini_messages[2].parts[0].function_response.response, {"result": "success"})
        self.assertEqual(gemini_messages[2].parts[0].function_response.id, "tc_1")
