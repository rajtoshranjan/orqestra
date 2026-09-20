import asyncio
import json
from time import monotonic
from types import SimpleNamespace
from unittest import mock

import httpx
from django.test import SimpleTestCase

from ..llm.anthropic_provider import AnthropicProvider
from ..llm.base import CATALOG_MAX_BODY_BYTES, CATALOG_READ_CHUNK_BYTES
from ..llm.ollama_provider import OllamaProvider
from ..llm.openai_provider import OpenAIProvider
from orqestra.exceptions.api import LLMProviderError


class RecordingStream(httpx.AsyncByteStream):
    def __init__(self, chunks, *, clock=None, elapsed=0):
        self.chunks = chunks
        self.clock = clock
        self.elapsed = elapsed
        self.chunks_read = 0
        self.closed = False

    async def __aiter__(self):
        for chunk in self.chunks:
            if self.clock is not None:
                self.clock.now += self.elapsed
            self.chunks_read += 1
            yield chunk

    async def aclose(self):
        self.closed = True


class DrippingStream(RecordingStream):
    def __init__(self):
        super().__init__([])
        self.cancelled = False

    async def __aiter__(self):
        try:
            # Never fill the application's read buffer before the deadline.
            # Finite even if the timeout regresses, so a failed test cannot hang.
            for _ in range(100):
                await asyncio.sleep(0.02)
                self.chunks_read += 1
                yield b" "
        except asyncio.CancelledError:
            self.cancelled = True
            raise


class CatalogTransportTests(SimpleTestCase):
    def setUp(self):
        self.provider = OpenAIProvider(api_key="sk-secret")

    def mock_transport(self, handler):
        client_class = httpx.AsyncClient

        def build_client(**kwargs):
            return client_class(transport=httpx.MockTransport(handler), **kwargs)

        return mock.patch("httpx.AsyncClient", side_effect=build_client)

    def request(self, *, deadline=None):
        return self.provider._request_json(
            "GET", "/models",
            deadline=deadline if deadline is not None else monotonic() + 30,
        )

    def test_streamed_json_uses_identity_encoding_and_closes_response(self):
        stream = RecordingStream([b'{"data":', b' [{"id": "gpt-4o"}]}'])

        def handler(request):
            self.assertEqual(request.headers["accept-encoding"], "identity")
            self.assertEqual(request.headers["authorization"], "Bearer sk-secret")
            return httpx.Response(200, stream=stream)

        with self.mock_transport(handler):
            self.assertEqual(self.request(), {"data": [{"id": "gpt-4o"}]})
        self.assertEqual(stream.chunks_read, 2)
        self.assertTrue(stream.closed)

    def test_dripping_body_is_cancelled_even_before_one_buffer_is_filled(self):
        stream = DrippingStream()
        with self.mock_transport(lambda request: httpx.Response(200, stream=stream)):
            started = monotonic()
            with self.assertRaises(LLMProviderError) as caught:
                self.request(deadline=started + 0.5)
        self.assertLess(monotonic() - started, 2)
        self.assertIn("timed out", str(caught.exception))
        self.assertNotIn("sk-secret", str(caught.exception))
        self.assertLess(stream.chunks_read, CATALOG_READ_CHUNK_BYTES)
        self.assertTrue(stream.cancelled)
        self.assertTrue(stream.closed)

    def test_deadline_also_cancels_waiting_for_headers(self):
        cancelled = []

        async def handler(request):
            try:
                await asyncio.sleep(3)
            except asyncio.CancelledError:
                cancelled.append(True)
                raise
            return httpx.Response(200, json={"data": []})

        with self.mock_transport(handler):
            started = monotonic()
            with self.assertRaises(LLMProviderError) as caught:
                self.request(deadline=started + 0.5)
        self.assertLess(monotonic() - started, 2)
        self.assertEqual(cancelled, [True])
        self.assertIn("timed out", str(caught.exception))

    def test_an_expired_deadline_does_not_send_credentials(self):
        with (
            mock.patch("httpx.AsyncClient") as client,
            self.assertRaises(LLMProviderError) as caught,
        ):
            self.request(deadline=monotonic() - 1)
        client.assert_not_called()
        self.assertIn("timed out", str(caught.exception))

    def test_content_length_over_limit_is_rejected_without_reading(self):
        stream = RecordingStream([b"sk-secret"])
        response = httpx.Response(
            200, stream=stream,
            headers={"Content-Length": str(CATALOG_MAX_BODY_BYTES + 1)},
        )
        with (
            self.mock_transport(lambda request: response),
            self.assertRaises(LLMProviderError) as caught,
        ):
            self.request()
        self.assertIn("too large", str(caught.exception))
        self.assertNotIn("sk-secret", str(caught.exception))
        self.assertEqual(stream.chunks_read, 0)
        self.assertTrue(stream.closed)

    def test_actual_body_size_is_bounded_with_absent_or_dishonest_length(self):
        for headers in ({}, {"Content-Length": "10"}):
            with self.subTest(headers=headers):
                chunk = b" " * CATALOG_READ_CHUNK_BYTES
                stream = RecordingStream([chunk] * 40)
                response = httpx.Response(200, stream=stream, headers=headers)
                with self.mock_transport(lambda request: response):
                    with self.assertRaises(LLMProviderError) as caught:
                        self.request()
                self.assertIn("too large", str(caught.exception))
                self.assertEqual(
                    stream.chunks_read,
                    CATALOG_MAX_BODY_BYTES // CATALOG_READ_CHUNK_BYTES + 1,
                )
                self.assertTrue(stream.closed)

    def test_body_at_the_size_limit_is_allowed(self):
        payload = b'{"data": []}'
        body = payload + b" " * (CATALOG_MAX_BODY_BYTES - len(payload))
        stream = RecordingStream([
            body[index:index + CATALOG_READ_CHUNK_BYTES]
            for index in range(0, len(body), CATALOG_READ_CHUNK_BYTES)
        ])
        with self.mock_transport(lambda request: httpx.Response(200, stream=stream)):
            self.assertEqual(self.request(), {"data": []})
        self.assertTrue(stream.closed)

    def test_compression_cannot_bypass_the_body_bound(self):
        stream = RecordingStream([b"sk-secret"])
        response = httpx.Response(
            200, stream=stream, headers={"Content-Encoding": "gzip"}
        )
        with self.mock_transport(lambda request: response):
            with self.assertRaises(LLMProviderError) as caught:
                self.request()
        self.assertIn("uncompressed", str(caught.exception))
        self.assertNotIn("sk-secret", str(caught.exception))
        self.assertEqual(stream.chunks_read, 0)
        self.assertTrue(stream.closed)

    def test_invalid_json_and_length_errors_are_sanitized_and_close_stream(self):
        for headers in ({}, {"Content-Length": "sk-secret"}):
            with self.subTest(headers=headers):
                stream = RecordingStream([b"not json: sk-secret"])
                response = httpx.Response(200, stream=stream, headers=headers)
                with self.mock_transport(lambda request: response):
                    with self.assertRaises(LLMProviderError) as caught:
                        self.request()
                self.assertNotIn("sk-secret", str(caught.exception))
                self.assertTrue(stream.closed)

    def test_redirect_and_non_429_error_bodies_are_not_read_or_followed(self):
        for status_code in (302, 307, 401, 500):
            with self.subTest(status=status_code):
                stream = RecordingStream([b"sk-secret"])
                requests_seen = []

                def handler(request):
                    requests_seen.append(str(request.url))
                    return httpx.Response(
                        status_code, stream=stream,
                        headers={"Location": "https://attacker.example"},
                    )

                with self.mock_transport(handler):
                    with self.assertRaises(LLMProviderError) as caught:
                        self.request()
                self.assertEqual(requests_seen, ["https://api.openai.com/v1/models"])
                self.assertNotIn("sk-secret", str(caught.exception))
                self.assertEqual(stream.chunks_read, 0)
                self.assertTrue(stream.closed)

    def test_429_body_is_read_for_classification_without_following_redirects(self):
        stream = RecordingStream([
            b'{"error":{"code":"insufficient_quota","message":"sk-secret"}}'
        ])
        requests_seen = []

        def handler(request):
            requests_seen.append(str(request.url))
            return httpx.Response(
                429, stream=stream,
                headers={"Location": "https://attacker.example"},
            )

        with self.mock_transport(handler):
            with self.assertRaises(LLMProviderError) as caught:
                self.request()
        self.assertEqual(requests_seen, ["https://api.openai.com/v1/models"])
        self.assertIn("insufficient_quota", str(caught.exception))
        self.assertNotIn("sk-secret", str(caught.exception))
        self.assertEqual(stream.chunks_read, 1)
        self.assertTrue(stream.closed)

    def test_pagination_uses_one_deadline_and_never_returns_partial_catalog(self):
        clock = SimpleNamespace(now=0.0)
        requests_seen = []
        first = RecordingStream([json.dumps({
            "data": [{"id": "claude-sonnet-4"}],
            "has_more": True, "last_id": "next",
        }).encode()], clock=clock, elapsed=20)
        second = RecordingStream([b'{"data": [], "has_more": false}'], clock=clock, elapsed=11)
        streams = iter([first, second])

        def handler(request):
            requests_seen.append(request)
            return httpx.Response(200, stream=next(streams))

        with mock.patch("agent.llm.base.monotonic", side_effect=lambda: clock.now):
            with self.mock_transport(handler), self.assertRaises(LLMProviderError) as caught:
                AnthropicProvider(api_key="sk-secret").list_models()
        self.assertIn("timed out", str(caught.exception))
        self.assertEqual(len(requests_seen), 2)
        self.assertEqual(requests_seen[0].extensions["timeout"]["read"], 30)
        self.assertEqual(requests_seen[1].extensions["timeout"]["read"], 10)
        self.assertEqual(requests_seen[1].url.params["after_id"], "next")
        self.assertTrue(first.closed and second.closed)

    def test_ollama_capability_probes_share_the_catalog_deadline(self):
        clock = SimpleNamespace(now=0.0)
        requests_seen = []
        tags = RecordingStream([json.dumps({"models": [
            {"name": "first"}, {"name": "second"},
        ]}).encode()], clock=clock, elapsed=20)
        details = RecordingStream([b'{"capabilities": ["tools"]}'], clock=clock, elapsed=11)
        streams = iter([tags, details])

        def handler(request):
            requests_seen.append(request)
            return httpx.Response(200, stream=next(streams))

        with mock.patch("agent.llm.base.monotonic", side_effect=lambda: clock.now):
            with self.mock_transport(handler), self.assertRaises(LLMProviderError):
                OllamaProvider(base_url="http://localhost:11434").list_models()
        self.assertEqual([request.url.path for request in requests_seen], ["/api/tags", "/api/show"])
        self.assertEqual(requests_seen[1].extensions["timeout"]["read"], 10)
        self.assertTrue(tags.closed and details.closed)
