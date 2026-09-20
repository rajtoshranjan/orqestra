from unittest import mock

import httpx
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from agent.llm.anthropic_provider import AnthropicProvider
from agent.llm.gemini_provider import GeminiProvider
from agent.llm.ollama_provider import OllamaProvider
from agent.llm.openai_provider import OpenAIProvider
from agent.llm.types import LLMModel
from agent.tests.http_fakes import CatalogResponse
from orqestra.exceptions.api import LLMProviderError


class ModelDiscoveryTests(SimpleTestCase):
    def test_openai_catalog_uses_live_ids_and_excludes_incompatible_variants(self):
        compatible = [
            "gpt-4o", "gpt-4.1-mini", "o3-mini", "gpt-5", "gpt-4-turbo",
            "gpt-3.5-turbo-0125",
        ]
        incompatible = [
            "text-embedding-3-small", "gpt-image-1", "dall-e-3", "whisper-1",
            "tts-1", "gpt-4o-audio-preview", "gpt-4o-realtime-preview",
            "gpt-4o-mini-search-preview", "gpt-4o-transcribe", "gpt-3.5-turbo-instruct",
            "o1-preview", "o1-mini", "o3-pro", "o3-deep-research", "gpt-5-pro",
            "gpt-5-codex", "gpt-5-chat-latest", "unrecognised-model",
            "gpt-4", "gpt-4-0613", "gpt-4-32k", "gpt-4-32k-0613",
            "gpt-3.5-turbo-0613", "gpt-3.5-turbo-16k", "gpt-4o-2099-01-01",
        ]
        response = CatalogResponse({
            "data": [{"id": model} for model in compatible + incompatible]
        })
        with mock.patch("httpx.AsyncClient.stream", return_value=response) as request:
            models = OpenAIProvider(api_key="secret").list_models()
        self.assertEqual([model.id for model in models], sorted(compatible))
        self.assertEqual(
            request.call_args.args, ("GET", "https://api.openai.com/v1/models")
        )
        self.assertFalse(request.call_args.kwargs["follow_redirects"])
        self.assertGreater(request.call_args.kwargs["timeout"].read, 0)
        self.assertLessEqual(request.call_args.kwargs["timeout"].read, 30)

    def test_anthropic_pagination_and_display_names(self):
        pages = [
            CatalogResponse({
                "data": [{"id": "claude-sonnet-4-20250514", "display_name": "Sonnet 4"}],
                "has_more": True, "last_id": "cursor-one",
            }),
            CatalogResponse({
                "data": [{"id": "claude-3-5-haiku-latest", "display_name": "Haiku"}],
                "has_more": False,
            }),
        ]
        with mock.patch("httpx.AsyncClient.stream", side_effect=pages) as request:
            models = AnthropicProvider(api_key="secret").list_models()
        self.assertEqual(models, [
            LLMModel(id="claude-3-5-haiku-latest", name="Haiku"),
            LLMModel(id="claude-sonnet-4-20250514", name="Sonnet 4"),
        ])
        self.assertEqual(request.call_args_list[0].kwargs["params"], {"limit": 100})
        self.assertEqual(request.call_args.kwargs["params"]["after_id"], "cursor-one")
        self.assertEqual(request.call_args.kwargs["headers"]["x-api-key"], "secret")

    def test_gemini_pagination_normalization_and_supported_generation_methods(self):
        rows = [
            {"name": "models/gemini-2.5-flash", "displayName": "Flash",
             "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/gemini-2.5-flash-image", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/gemini-2.5-flash-preview-tts", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/gemini-embedding-001", "supportedGenerationMethods": ["embedContent"]},
            {"name": "models/gemini-2.0-flash", "supportedGenerationMethods": ["countTokens"]},
            {"name": "models/imagen-4", "supportedGenerationMethods": ["predict"]},
            {"name": "models/gemma-3-27b-it", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/gemini-3-pro-preview", "supportedGenerationMethods": ["generateContent"]},
        ]
        with mock.patch("httpx.AsyncClient.stream", side_effect=[
            CatalogResponse({"models": rows, "nextPageToken": "next"}),
            CatalogResponse({}),
        ]) as request:
            models = GeminiProvider(api_key="secret").list_models()
        self.assertEqual(models, [LLMModel(id="gemini-2.5-flash", name="Flash")])
        self.assertEqual(request.call_args.kwargs["params"]["pageToken"], "next")
        self.assertEqual(request.call_args.kwargs["headers"], {"x-goog-api-key": "secret"})
        self.assertNotIn("secret", request.call_args.args[1])

    def test_ollama_uses_reported_tool_capabilities_including_custom_models(self):
        with mock.patch("httpx.AsyncClient.stream", side_effect=[
            CatalogResponse({"models": [{"name": "custom:latest"}, {"name": "embed:latest"}]}),
            CatalogResponse({"capabilities": ["completion", "tools"]}),
            CatalogResponse({"capabilities": ["embedding"]}),
        ]) as request:
            models = OllamaProvider(base_url="http://localhost:11434/").list_models()
        self.assertEqual(models, [LLMModel(id="custom:latest", name="custom:latest")])
        self.assertEqual(
            request.call_args_list[1].args,
            ("POST", "http://localhost:11434/api/show"),
        )
        self.assertEqual(request.call_args_list[1].kwargs["json"], {"model": "custom:latest"})
        self.assertEqual(request.call_args.kwargs["headers"], {})

    def test_ollama_missing_capabilities_is_an_error_not_a_guessed_catalog(self):
        with mock.patch("httpx.AsyncClient.stream", side_effect=[
            CatalogResponse({"models": [{"name": "qwen3:8b"}]}),
            CatalogResponse({"details": {"family": "qwen3"}}),
        ]), self.assertRaises(LLMProviderError) as caught:
            OllamaProvider(base_url="https://ollama.com", api_key="secret").list_models()
        self.assertIn("Upgrade Ollama", str(caught.exception))

    def test_empty_catalogs_remain_empty(self):
        for provider, payload in (
            (OpenAIProvider(api_key="secret"), {"data": []}),
            (AnthropicProvider(api_key="secret"), {"data": []}),
            (GeminiProvider(api_key="secret"), {}),
            (OllamaProvider(base_url="http://localhost:11434"), {"models": []}),
        ):
            with self.subTest(provider=provider.name), mock.patch(
                "httpx.AsyncClient.stream", return_value=CatalogResponse(payload)
            ):
                self.assertEqual(provider.list_models(), [])

    def test_repeated_pagination_cursor_and_missing_cursor_fail_safely(self):
        for page in (
            {"data": [], "has_more": True, "last_id": "repeated"},
            {"data": [], "has_more": True},
        ):
            with self.subTest(page=page), mock.patch(
                "httpx.AsyncClient.stream", return_value=CatalogResponse(page)
            ) as request, self.assertRaises(LLMProviderError):
                AnthropicProvider(api_key="secret").list_models()
            self.assertLessEqual(request.call_count, 2)

    def test_all_providers_sanitize_status_transport_and_malformed_body_errors(self):
        providers = [
            OpenAIProvider(api_key="secret"), AnthropicProvider(api_key="secret"),
            GeminiProvider(api_key="secret"),
            OllamaProvider(api_key="secret", base_url="https://ollama.com"),
        ]
        for provider in providers:
            for status_code in (401, 403, 429, 500, 302):
                with self.subTest(provider=provider.name, status=status_code), mock.patch(
                    "httpx.AsyncClient.stream",
                    return_value=CatalogResponse({"error": "secret"}, status_code),
                ), self.assertRaises(LLMProviderError) as caught:
                    provider.list_models()
                self.assertNotIn("secret", str(caught.exception))
            with self.subTest(provider=provider.name), mock.patch(
                "httpx.AsyncClient.stream", side_effect=httpx.ReadTimeout("secret")
            ), self.assertRaises(LLMProviderError) as caught:
                provider.list_models()
            self.assertIn("timed out", str(caught.exception))
            self.assertNotIn("secret", str(caught.exception))
            with mock.patch(
                "httpx.AsyncClient.stream", return_value=CatalogResponse(["secret"])
            ), self.assertRaises(LLMProviderError):
                provider.list_models()

    def test_malformed_names_and_unrecognised_catalog_shapes_are_errors(self):
        cases = [
            (AnthropicProvider(api_key="secret"), {
                "data": [{"id": "claude-sonnet-4", "display_name": 123}],
            }),
            (GeminiProvider(api_key="secret"), {"unexpected": "secret"}),
            (OllamaProvider(base_url="http://localhost:11434"), {
                "models": [{"model": "qwen3:8b", "name": 123}],
            }),
        ]
        for provider, payload in cases:
            with self.subTest(provider=provider.name), mock.patch(
                "httpx.AsyncClient.stream", return_value=CatalogResponse(payload)
            ), self.assertRaises(LLMProviderError) as caught:
                provider.list_models()
            self.assertNotIn("secret", str(caught.exception))

    def test_invalid_json_catalog_never_echoes_response_bytes(self):
        response = CatalogResponse({})
        response.body = b"not json: secret"
        with mock.patch(
            "httpx.AsyncClient.stream", return_value=response
        ), self.assertRaises(LLMProviderError) as caught:
            OpenAIProvider(api_key="secret").list_models()
        self.assertNotIn("secret", str(caught.exception))

    def test_fixed_endpoints_cannot_be_overridden_even_with_a_new_key(self):
        for provider in (OpenAIProvider, AnthropicProvider, GeminiProvider):
            with self.subTest(provider=provider.name), mock.patch(
                "httpx.AsyncClient.stream"
            ) as request:
                with self.assertRaises(ValidationError):
                    provider(api_key="secret", base_url="https://attacker.example")
                request.assert_not_called()

    def test_endpoint_normalization_is_deliberately_narrow(self):
        self.assertEqual(
            OllamaProvider.normalize_endpoint("HTTPS://OLLAMA.COM:443/"),
            "https://ollama.com",
        )
        self.assertEqual(
            OllamaProvider.normalize_endpoint("http://[::1]:11434/"),
            "http://[::1]:11434",
        )
        for endpoint in (
            "ftp://localhost", "//localhost", "localhost:11434", "https://user:secret@host",
            "https://host?key=secret", "https://host#secret", "https://host?", "https://host#",
            "https://host:invalid", "https://host:99999", "https://host/path/../other",
            "https://host/%2e%2e/other", "https://host\\@attacker", "https://host\n/secret",
        ):
            with self.subTest(endpoint=endpoint), self.assertRaises(ValidationError) as caught:
                OllamaProvider.normalize_endpoint(endpoint)
            self.assertNotIn("secret", str(caught.exception))
