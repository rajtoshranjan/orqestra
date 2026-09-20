from unittest import mock

import requests
from django.test import SimpleTestCase

from agent.constants import MessageRole, RunStatus
from agent.engine import AgentEngine
from agent.llm.mappers import (
    from_openai_models,
    openai_model_limits,
    to_openai_messages,
    to_openai_request,
    to_openai_tools,
)
from agent.llm.openai_provider import OpenAIProvider
from agent.llm.registry import build_provider, llm_registry
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
from agent.models import AgentConversation, AgentMessage, AgentRun
from agent.tests.http_fakes import json_response, openai_text_response, sse_response
from organisations.models import LLMConfig
from orqestra.exceptions.api import LLMProviderError
from orqestra.tests import BaseTestCase
from projects.models import Project
from utils.encryption import encrypt_val

TOOLS = [ToolSpec(name="configure", description="Configure a node", input_schema={"type": "object"})]


def tool_response(arguments='{"node_id":"n1"}', reason="tool_calls"):
    return sse_response([
        {"choices": [{"delta": {"tool_calls": [{
            "index": 0, "id": "call_one", "type": "function",
            "function": {"name": "configure", "arguments": arguments},
        }]}, "finish_reason": reason}]},
        {"choices": [], "usage": {"prompt_tokens": 12, "completion_tokens": 5}},
    ])


class OpenAIMappingTests(SimpleTestCase):
    def test_history_preserves_parallel_call_ids_and_tool_results(self):
        messages = [
            LLMMessage(role=Role.USER, content=[TextBlock(text="hello")]),
            LLMMessage(role=Role.ASSISTANT, content=[
                TextBlock(text="Working"),
                ToolCallBlock(id="first", name="configure", input={"node_id": "n1"}),
                ToolCallBlock(id="second", name="validate", input={}),
            ]),
            LLMMessage(role=Role.TOOL, content=[
                ToolResultBlock(tool_call_id="first", content="failed", is_error=True),
                ToolResultBlock(tool_call_id="second", content="ok"),
            ]),
        ]
        mapped = to_openai_messages(messages)
        self.assertEqual(mapped[0], {"role": "user", "content": "hello"})
        self.assertEqual(mapped[1]["content"], "Working")
        self.assertEqual(mapped[1]["tool_calls"][0]["id"], "first")
        self.assertEqual(mapped[1]["tool_calls"][0]["function"]["arguments"], '{"node_id": "n1"}')
        self.assertEqual(mapped[2], {"role": "tool", "tool_call_id": "first", "content": "failed"})
        self.assertEqual(mapped[3]["tool_call_id"], "second")
        self.assertEqual(to_openai_tools(TOOLS)[0]["function"]["parameters"], {"type": "object"})

    def test_tool_only_message_uses_null_content(self):
        mapped = to_openai_messages([LLMMessage(role=Role.ASSISTANT, content=[
            ToolCallBlock(id="call", name="validate", input={}),
        ])])
        self.assertIsNone(mapped[0]["content"])


class OpenAIProviderTests(SimpleTestCase):
    def setUp(self):
        self.provider = OpenAIProvider(api_key="sk-secret", model="gpt-4o")

    def stream(self, response):
        with mock.patch("requests.post", return_value=response):
            return list(self.provider.stream(system_prompt="system", messages=[], tools=TOOLS))

    def test_registered_as_a_class_with_model_specific_context_limits(self):
        self.assertIs(llm_registry.get("openai"), OpenAIProvider)
        for model, limit in (
            ("gpt-4o", 128000), ("gpt-4.1", 1047576), ("gpt-4", 4096),
            ("gpt-3.5-turbo", 16385), ("unknown-future-model", 4096),
            ("gpt-4-turbo-unknown", 4096),
        ):
            with self.subTest(model=model):
                self.assertEqual(OpenAIProvider(model=model).capabilities.max_context_tokens, limit)
        self.assertEqual(OpenAIProvider(model="gpt-4o", context_window=999999).capabilities.max_context_tokens, 128000)
        self.assertEqual(OpenAIProvider(model="gpt-4o", context_window=16000).capabilities.max_context_tokens, 16000)
        self.assertEqual(
            OpenAIProvider(model="gpt-4.1", context_window=500000)
            .capabilities.max_context_tokens,
            500000,
        )
        self.assertEqual(
            OpenAIProvider(model="gpt-4.1", context_window=2000000)
            .capabilities.max_context_tokens,
            1047576,
        )

    def test_verified_context_and_output_limits_for_families_and_snapshots(self):
        for model, context, output in (
            ("gpt-4.1", 1047576, 32768),
            ("gpt-4.1-mini-2025-04-14", 1047576, 32768),
            ("gpt-4.1-nano", 1047576, 32768),
            ("gpt-4o", 128000, 16384),
            ("gpt-4o-2024-05-13", 128000, 4096),
            ("gpt-4o-2024-08-06", 128000, 16384),
            ("gpt-4o-mini-2024-07-18", 128000, 16384),
            ("gpt-4-turbo", 128000, 4096),
            ("gpt-4-turbo-2024-04-09", 128000, 4096),
            ("gpt-4-0125-preview", 128000, 4096),
            ("gpt-3.5-turbo", 16385, 4096),
            ("gpt-3.5-turbo-0125", 16385, 4096),
            ("gpt-3.5-turbo-1106", 16385, 4096),
            ("o1-2024-12-17", 200000, 100000),
            ("o3-mini", 200000, 100000),
            ("o4-mini-2025-04-16", 200000, 100000),
            ("gpt-5", 400000, 128000),
            ("gpt-5.1-2025-11-13", 400000, 128000),
            ("gpt-5.2", 400000, 128000),
        ):
            with self.subTest(model=model):
                limits = openai_model_limits(model)
                if limits is None:
                    self.fail(f"Missing limits for {model}")
                self.assertEqual(limits.max_context_tokens, context)
                self.assertEqual(limits.max_output_tokens, output)
                provider = OpenAIProvider(model=model)
                self.assertEqual(provider.capabilities.max_context_tokens, context)

    def test_catalog_models_cap_the_default_engine_output_allowance(self):
        model_ids = [
            "gpt-4-turbo", "gpt-4-turbo-preview", "gpt-4-1106-preview",
            "gpt-3.5-turbo", "gpt-3.5-turbo-0125", "gpt-3.5-turbo-1106",
            "gpt-4o-2024-05-13", "gpt-4o", "gpt-4.1", "o3-mini", "gpt-5",
        ]
        catalog = from_openai_models({"data": [{"id": model} for model in model_ids]})
        self.assertEqual(len(catalog.models), len(model_ids))
        for model in catalog.models:
            for requested_tokens in (16, 8192, 1000000):
                with self.subTest(model=model.id, requested=requested_tokens):
                    limits = openai_model_limits(model.id)
                    if limits is None:
                        self.fail(f"Discovered model has no limits: {model.id}")
                    with mock.patch("requests.post", return_value=openai_text_response()) as post:
                        list(OpenAIProvider(api_key="secret", model=model.id).stream(
                            system_prompt="sys", messages=[], tools=TOOLS,
                            max_tokens=requested_tokens,
                        ))
                    payload = post.call_args.kwargs["json"]
                    actual_tokens = payload.get("max_tokens", payload.get("max_completion_tokens"))
                    self.assertEqual(actual_tokens, min(requested_tokens, limits.max_output_tokens))
                    if requested_tokens == 8192:
                        self.assertLess(actual_tokens, limits.max_context_tokens // 2)

    def test_unknown_models_use_a_small_output_cap_but_are_not_discovered(self):
        model = "gpt-4o-2099-01-01"
        self.assertIsNone(openai_model_limits(model))
        self.assertEqual(from_openai_models({"data": [{"id": model}]}).models, [])
        payload = to_openai_request(
            model=model, system_prompt="", messages=[], tools=[],
            temperature=0, max_tokens=8192,
        )
        self.assertEqual(payload["max_tokens"], 1024)

    def test_text_usage_and_stop_are_canonical(self):
        self.assertEqual(self.stream(openai_text_response()), [
            TextDelta(text="ok"), Usage(input_tokens=11, output_tokens=7), Stop(reason="stop"),
        ])

    def test_interleaved_fragmented_parallel_calls_are_assembled(self):
        response = sse_response([
            {"choices": [{"delta": {"content": "Working", "tool_calls": [
                {"index": 1, "function": {"name": "validate", "arguments": "{"}},
                {"index": 0, "id": "call_one", "function": {"name": "configure", "arguments": '{"node_'}},
            ]}}]},
            {"choices": [{"delta": {"tool_calls": [
                {"index": 0, "function": {"arguments": 'id":"n1"}'}},
                {"index": 1, "function": {"arguments": "}"}},
            ]}, "finish_reason": "tool_calls"}]},
            {"choices": [], "usage": {"prompt_tokens": 21, "completion_tokens": 9}},
        ])
        events = self.stream(response)
        calls = [event for event in events if isinstance(event, ToolCallRequested)]
        self.assertEqual(calls[0], ToolCallRequested(id="call_one", name="configure", input={"node_id": "n1"}))
        self.assertTrue(calls[1].id)
        self.assertNotEqual(calls[0].id, calls[1].id)
        self.assertEqual(calls[1].input, {})
        self.assertIn(Usage(input_tokens=21, output_tokens=9), events)
        self.assertEqual(events[-1], Stop(reason="tool_calls"))

    def test_missing_ids_are_unique_across_calls(self):
        response = sse_response([{"choices": [{"delta": {"tool_calls": [
            {"index": 0, "function": {"name": "validate", "arguments": "{}"}},
            {"index": 1, "function": {"name": "validate", "arguments": "{}"}},
        ]}, "finish_reason": "tool_calls"}]}])
        calls = [event for event in self.stream(response) if isinstance(event, ToolCallRequested)]
        self.assertEqual(len({call.id for call in calls}), 2)
        self.assertTrue(all(call.id for call in calls))

    def test_truncation_preserves_finish_reason_without_partial_tools(self):
        events = self.stream(tool_response(arguments='{"broken":', reason="length"))
        self.assertEqual(events[-1], Stop(reason="length"))
        self.assertFalse(any(isinstance(event, ToolCallRequested) for event in events))

    def test_invalid_arguments_never_become_operations(self):
        for arguments in ('{"sk-secret":', '[]', '"sk-secret"'):
            with self.subTest(arguments=arguments), self.assertRaises(LLMProviderError) as caught:
                self.stream(tool_response(arguments=arguments))
            self.assertNotIn("sk-secret", str(caught.exception))

    def test_incomplete_or_error_stream_is_not_a_success(self):
        for response in (
            sse_response([], done=False),
            sse_response([{"choices": [{"delta": {"content": "partial"}}]}]),
            sse_response([{"error": {"message": "sk-secret"}}]),
        ):
            with self.subTest(response=response), self.assertRaises(LLMProviderError) as caught:
                self.stream(response)
            self.assertNotIn("sk-secret", str(caught.exception))

    def test_http_errors_are_actionable_without_echoing_vendor_bodies(self):
        for status_code, expected in ((401, "API key"), (403, "permissions"), (429, "quota"), (404, "not found"), (500, "unavailable"), (307, "redirect")):
            with self.subTest(status=status_code), self.assertRaises(LLMProviderError) as caught:
                self.stream(json_response({"error": "sk-secret"}, status_code))
            self.assertIn(expected, str(caught.exception))
            self.assertNotIn("sk-secret", str(caught.exception))

    def test_transport_failures_and_missing_key_are_safe(self):
        for failure in (requests.Timeout("sk-secret"), requests.ConnectionError("sk-secret")):
            with mock.patch("requests.post", side_effect=failure):
                with self.assertRaises(LLMProviderError) as caught:
                    list(self.provider.stream(system_prompt="", messages=[], tools=[]))
            self.assertNotIn("sk-secret", str(caught.exception))
        with mock.patch("requests.post") as post, self.assertRaises(LLMProviderError):
            list(OpenAIProvider().stream(system_prompt="", messages=[], tools=[]))
        post.assert_not_called()

    def test_request_uses_fixed_endpoint_bounded_timeout_and_no_redirects(self):
        with mock.patch("requests.post", return_value=openai_text_response()) as post:
            list(self.provider.stream(system_prompt="sys", messages=[], tools=TOOLS, max_tokens=512))
        self.assertEqual(post.call_args.args[0], "https://api.openai.com/v1/chat/completions")
        self.assertFalse(post.call_args.kwargs["allow_redirects"])
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "Bearer sk-secret")
        payload = post.call_args.kwargs["json"]
        self.assertEqual(payload["max_tokens"], 512)
        self.assertEqual(payload["stream_options"], {"include_usage": True})
        self.assertEqual(payload["messages"][0]["role"], "system")

    def test_reasoning_models_omit_unsupported_temperature(self):
        for model in ("o3-mini", "gpt-5"):
            with self.subTest(model=model), mock.patch("requests.post", return_value=openai_text_response()) as post:
                list(OpenAIProvider(api_key="key", model=model).stream(system_prompt="sys", messages=[], tools=[], max_tokens=1024))
            payload = post.call_args.kwargs["json"]
            self.assertEqual(payload["max_completion_tokens"], 1024)
            self.assertNotIn("temperature", payload)
            self.assertNotIn("tools", payload)
            self.assertEqual(payload["messages"][0]["role"], "developer")


class OpenAIRunTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.config = LLMConfig.objects.create(
            organisation=self.organisation, name="OpenAI", provider="openai",
            model="gpt-4o", api_key=encrypt_val("sk-secret"),
        )
        project = Project.objects.create(organisation=self.organisation, name="P", nodes=[], edges=[])
        self.conversation = AgentConversation.objects.create(project=project, created_by=self.user)
        AgentMessage.objects.create(conversation=self.conversation, role="user", content=[{"type": "text", "text": "Configure node n1"}])
        self.run = AgentRun.objects.create(conversation=self.conversation)
        self.engine = AgentEngine(provider=build_provider(self.config))

    def test_tool_result_replays_through_real_adapter_and_completes_run(self):
        with mock.patch("requests.post", side_effect=[tool_response(), openai_text_response("Done")]) as post:
            first = self.engine.advance(self.run, operation_results=[], catalog=[])
            self.assertEqual(first.run_status, RunStatus.AWAITING_CLIENT.value)
            second = self.engine.advance(self.run, operation_results=[{
                "tool_call_id": "call_one", "content": "configured", "is_error": False,
            }], catalog=[])
        self.assertEqual(second.run_status, RunStatus.COMPLETED.value)
        messages = post.call_args.kwargs["json"]["messages"]
        self.assertIn({"role": "tool", "tool_call_id": "call_one", "content": "configured"}, messages)
        self.run.refresh_from_db()
        self.assertEqual(self.run.input_tokens, 23)
        self.assertEqual(self.run.output_tokens, 12)
        self.assertEqual(self.conversation.messages.filter(role=MessageRole.ASSISTANT.value).count(), 2)

    def test_default_engine_turn_caps_output_for_legacy_turbo_models(self):
        def respond(url, *, json, **kwargs):
            self.assertEqual(url, "https://api.openai.com/v1/chat/completions")
            self.assertFalse(kwargs["allow_redirects"])
            if json["max_tokens"] > 4096:
                return json_response({"error": "Output limit exceeded"}, 400)
            return openai_text_response()

        for model in ("gpt-4-turbo", "gpt-3.5-turbo-0125"):
            with self.subTest(model=model):
                run = AgentRun.objects.create(conversation=self.conversation)
                engine = AgentEngine(
                    provider=OpenAIProvider(api_key="secret", model=model)
                )
                with mock.patch("requests.post", side_effect=respond) as post:
                    result = engine.advance(run, operation_results=[], catalog=[])
                self.assertEqual(result.run_status, RunStatus.COMPLETED.value)
                self.assertEqual(post.call_args.kwargs["json"]["max_tokens"], 4096)

    def test_known_context_windows_retain_large_tool_results_on_replay(self):
        for model, result_size in (
            ("gpt-3.5-turbo-0125", 12000),
            ("gpt-4.1", 300000),
        ):
            with self.subTest(model=model):
                conversation = AgentConversation.objects.create(
                    project=self.conversation.project, created_by=self.user
                )
                AgentMessage.objects.create(
                    conversation=conversation,
                    role=MessageRole.USER.value,
                    content=[{"type": "text", "text": "Inspect the graph"}],
                )
                AgentMessage.objects.create(
                    conversation=conversation,
                    role=MessageRole.ASSISTANT.value,
                    content=[{
                        "type": "tool_call", "id": "graph_call",
                        "name": "query_graph", "input": {},
                    }],
                )
                # Exceeds the old history budget but fits the verified window.
                tool_result = "x" * result_size
                AgentMessage.objects.create(
                    conversation=conversation,
                    role=MessageRole.TOOL.value,
                    content=[{
                        "type": "tool_result", "tool_call_id": "graph_call",
                        "content": tool_result, "is_error": False,
                    }],
                )
                run = AgentRun.objects.create(conversation=conversation)
                engine = AgentEngine(
                    provider=OpenAIProvider(api_key="secret", model=model)
                )
                with mock.patch(
                    "requests.post", return_value=openai_text_response()
                ) as post:
                    result = engine.advance(run, operation_results=[], catalog=[])
                self.assertEqual(result.run_status, RunStatus.COMPLETED.value)
                messages = post.call_args.kwargs["json"]["messages"]
                self.assertEqual(
                    messages[2]["tool_calls"][0]["id"], "graph_call"
                )
                self.assertEqual(messages[3], {
                    "role": "tool", "tool_call_id": "graph_call",
                    "content": tool_result,
                })

    def test_truncated_run_fails_instead_of_applying_tools(self):
        with mock.patch("requests.post", return_value=tool_response(reason="length")):
            result = self.engine.advance(self.run, operation_results=[], catalog=[])
        self.assertEqual(result.run_status, RunStatus.FAILED.value)
        self.assertEqual(result.operations, [])

    def test_provider_error_persisted_on_run_contains_no_key(self):
        with mock.patch("requests.post", return_value=json_response({"error": "sk-secret"}, 401)):
            result = self.engine.advance(self.run, operation_results=[], catalog=[])
        self.assertEqual(result.run_status, RunStatus.FAILED.value)
        self.run.refresh_from_db()
        self.assertNotIn("sk-secret", str(self.run.error))
