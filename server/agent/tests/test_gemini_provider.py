from unittest import mock

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
from agent.tests.http_fakes import json_response, sse_response
from django.test import SimpleTestCase
from google.genai import types
from orqestra.exceptions.api import LLMProviderError



class GeminiProviderTests(SimpleTestCase):
    def test_name_and_capabilities(self):
        provider = GeminiProvider(api_key="secret", model="gemini-2.5-flash")

        self.assertEqual(provider.name, "gemini")
        self.assertTrue(provider.capabilities.supports_tools)
        self.assertTrue(provider.capabilities.supports_streaming)

    def test_stream_yields_canonical_events(self):
        response = sse_response([
            {"candidates": [{"content": {"parts": [{"text": "Adding "}]}}]},
            {"candidates": [{"content": {"parts": [
                {"text": "a Lambda"},
                {"functionCall": {
                    "id": "tc_1", "name": "add_resource", "args": {"service_id": "lambda"},
                }},
            ]}}]},
            {"candidates": [{"finishReason": "STOP"}],
             "usageMetadata": {"promptTokenCount": 11, "candidatesTokenCount": 7}},
        ], done=False)
        provider = GeminiProvider(api_key="secret", model="gemini-2.5-flash")
        with mock.patch("requests.post", return_value=response) as post:
            events = list(provider.stream(
                system_prompt="system",
                messages=[LLMMessage(role=Role.USER, content=[TextBlock(text="hello")])],
                tools=[ToolSpec(
                    name="add_resource", description="description", input_schema={"type": "object"},
                )],
            ))
        self.assertFalse(post.call_args.kwargs["allow_redirects"])
        self.assertEqual(post.call_args.kwargs["headers"], {"x-goog-api-key": "secret"})
        self.assertEqual(post.call_args.kwargs["json"]["contents"], [
            {"role": "user", "parts": [{"text": "hello"}]},
        ])

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

    def test_redirects_and_error_bodies_never_forward_or_echo_the_key(self):
        for status_code in (302, 307, 401, 500):
            with self.subTest(status=status_code), mock.patch(
                "requests.post", return_value=json_response({"error": "secret"}, status_code)
            ) as post, self.assertRaises(LLMProviderError) as caught:
                list(GeminiProvider(api_key="secret", model="gemini-2.5-flash").stream(
                    system_prompt="", messages=[], tools=[],
                ))
            self.assertFalse(post.call_args.kwargs["allow_redirects"])
            self.assertNotIn("secret", str(caught.exception))

    def test_incomplete_stream_fails_and_reasoning_is_not_public_text(self):
        response = sse_response([{"candidates": [{"content": {"parts": [
            {"text": "private reasoning", "thought": True},
        ]}}]}], done=False)
        with mock.patch("requests.post", return_value=response), self.assertRaises(LLMProviderError):
            list(GeminiProvider(api_key="secret").stream(system_prompt="", messages=[], tools=[]))

    def test_native_request_preserves_tool_history_and_counts_thinking_usage(self):
        response = sse_response([{
            "candidates": [{"content": {"parts": [
                {"text": "hidden", "thought": True}, {"text": "done"},
            ]}, "finishReason": "STOP"}],
            "usageMetadata": {
                "promptTokenCount": 10, "candidatesTokenCount": 3, "thoughtsTokenCount": 2,
            },
        }], done=False)
        messages = [
            LLMMessage(role=Role.ASSISTANT, content=[
                ToolCallBlock(id="call", name="validate", input={}),
            ]),
            LLMMessage(role=Role.TOOL, content=[
                ToolResultBlock(tool_call_id="call", content="ok"),
            ]),
        ]
        with mock.patch("requests.post", return_value=response) as post:
            events = list(GeminiProvider(api_key="secret", model="gemini-2.5-flash").stream(
                system_prompt="sys", messages=messages, tools=[],
            ))
        self.assertEqual(events, [TextDelta(text="done"), Usage(10, 5), Stop(reason="stop")])
        contents = post.call_args.kwargs["json"]["contents"]
        self.assertEqual(contents[0]["parts"][0]["functionCall"]["id"], "call")
        self.assertEqual(contents[1], {
            "role": "user", "parts": [{"functionResponse": {
                "id": "call", "name": "validate", "response": {"result": "ok"},
            }}],
        })

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
        dumped = decl.parameters.model_dump(mode="json", exclude_none=True)
        self.assertEqual(dumped.get("type").upper(), "OBJECT")
        self.assertEqual(
            dumped.get("properties", {}).get("type", {}).get("type").upper(), "STRING"
        )
        self.assertEqual(
            dumped.get("properties", {}).get("parent_id", {}).get("type").upper(),
            "STRING",
        )

    def test_to_gemini_messages(self):
        messages = [
            LLMMessage(
                role=Role.USER,
                content=[TextBlock(text="Help me configure Lambda")],
            ),
            LLMMessage(
                role=Role.ASSISTANT,
                content=[
                    ToolCallBlock(
                        id="tc_1", name="add_resource", input={"type": "lambda"}
                    )
                ],
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
        self.assertEqual(
            gemini_messages[1].parts[0].function_call.args, {"type": "lambda"}
        )
        self.assertEqual(gemini_messages[1].parts[0].function_call.id, "tc_1")

        # Verify tool response message.
        self.assertEqual(gemini_messages[2].role, "tool")
        self.assertEqual(len(gemini_messages[2].parts), 1)
        self.assertEqual(
            gemini_messages[2].parts[0].function_response.name, "add_resource"
        )
        self.assertEqual(
            gemini_messages[2].parts[0].function_response.response,
            {"result": "success"},
        )
        self.assertEqual(gemini_messages[2].parts[0].function_response.id, "tc_1")
