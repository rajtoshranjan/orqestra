import json
from unittest import mock

import requests
from django.test import SimpleTestCase
from orqestra.exceptions.api import LLMProviderError

from ..llm.errors import ERROR_MAX_BODY_BYTES
from ..llm.mappers import from_openai_error
from ..llm.openai_provider import OpenAIProvider
from .http_fakes import CatalogResponse, json_response


class OpenAIErrorTests(SimpleTestCase):
    def setUp(self):
        self.provider = OpenAIProvider(model="gpt-4o", api_key="sk-secret")

    def test_chat_and_discovery_distinguish_billing_from_rate_limits(self):
        cases = (
            ("insufficient_quota", "insufficient_quota", "Retrying alone"),
            ("credit_balance_exhausted", "insufficient_quota", "Add credits"),
            ("project_spend_limit_exceeded", "insufficient_quota", "project's API spend limit"),
            ("organization_spend_limit_exceeded", "insufficient_quota", "organisation's API spend limit"),
            ("organization_usage_limit_exceeded", "insufficient_quota", "higher approved usage limit"),
            ("rate_limit_exceeded", "tokens", "temporarily rate-limited"),
            ("slow_down", "rate_limit_error", "temporarily rate-limited"),
            (None, "rate_limit_error", "temporarily rate-limited"),
            (None, "insufficient_quota", "Retrying alone"),
        )
        for code, error_type, expected in cases:
            payload = {"error": {
                "code": code, "type": error_type,
                "message": "secret org-id project-id sk-secret",
            }}
            for operation in ("chat", "discovery"):
                with self.subTest(code=code, operation=operation):
                    with mock.patch("requests.post", return_value=json_response(payload, 429)) as post:
                        with mock.patch("httpx.AsyncClient.stream", return_value=CatalogResponse(payload, 429)) as request:
                            with self.assertRaises(LLMProviderError) as caught:
                                if operation == "chat":
                                    list(self.provider.stream(system_prompt="", messages=[], tools=[]))
                                else:
                                    self.provider.list_models()
                    message = str(caught.exception)
                    self.assertIn(expected, message)
                    self.assertNotIn("sk-secret", message)
                    self.assertNotIn("org-id", message)
                    self.assertNotIn("project-id", message)
                    self.assertEqual(post.call_count + request.call_count, 1)

    def test_unknown_or_invalid_bodies_preserve_429_without_echoing_them(self):
        bodies = (
            b"", b"not-json sk-secret", b"<html>sk-secret</html>",
            b"\xff", b"[]", b"null",
            json.dumps({"error": "sk-secret"}).encode(),
            json.dumps({"error": {"code": "sk-secret", "type": "org-secret"}}).encode(),
            json.dumps({"error": {"code": ["sk-secret"], "type": {"key": "sk-secret"}}}).encode(),
        )
        for body in bodies:
            with self.subTest(body=body):
                message = str(from_openai_error(429, body))
                self.assertIn("429 without a recognised", message)
                self.assertIn("ChatGPT subscriptions", message)
                self.assertNotIn("sk-secret", message)
                self.assertNotIn("org-secret", message)

    def test_code_is_more_specific_than_broad_insufficient_quota_type(self):
        error = from_openai_error(429, json.dumps({"error": {
            "code": "project_spend_limit_exceeded", "type": "insufficient_quota",
        }}).encode())
        self.assertIn("project's API spend limit", str(error))
        self.assertNotIn("Add credits", str(error))

    def test_non_429_status_is_not_misreported_as_billing(self):
        body = b'{"error":{"code":"insufficient_quota"}}'
        self.assertIn("API key", str(from_openai_error(401, body)))
        self.assertIn("unavailable", str(from_openai_error(503, body)))

    def test_oversized_error_body_falls_back_to_original_status(self):
        payload = {"error": {"code": "insufficient_quota", "message": "x" * ERROR_MAX_BODY_BYTES}}
        with mock.patch("requests.post", return_value=json_response(payload, 429)):
            with self.assertRaises(LLMProviderError) as caught:
                list(self.provider.stream(system_prompt="", messages=[], tools=[]))
        self.assertIn("429 without a recognised", str(caught.exception))
        with mock.patch("httpx.AsyncClient.stream", return_value=CatalogResponse(payload, 429)):
            with self.assertRaises(LLMProviderError) as caught:
                self.provider.list_models()
        self.assertIn("429 without a recognised", str(caught.exception))

    def test_unreadable_chat_body_does_not_mask_the_429(self):
        response = json_response({}, 429)
        with mock.patch("requests.post", return_value=response):
            with mock.patch.object(response, "iter_content", side_effect=requests.Timeout("sk-secret")):
                with self.assertRaises(LLMProviderError) as caught:
                    list(self.provider.stream(system_prompt="", messages=[], tools=[]))
        self.assertIn("429 without a recognised", str(caught.exception))
        self.assertNotIn("sk-secret", str(caught.exception))
