import json

import httpx
import requests


class CatalogResponse:
    """Reusable stand-in for HTTPX's streamed async response context."""

    def __init__(self, payload, status_code=200):
        self.status_code = status_code
        self.headers = {}
        self.body = json.dumps(payload).encode()

    async def __aenter__(self):
        self.response = httpx.Response(
            self.status_code,
            headers=self.headers,
            stream=httpx.ByteStream(self.body),
        )
        return self.response

    async def __aexit__(self, *args):
        await self.response.aclose()


def json_response(payload, status_code=200):
    response = requests.Response()
    response.status_code = status_code
    response._content = json.dumps(payload).encode()
    response._content_consumed = True
    return response


def sse_response(chunks, *, done=True):
    response = requests.Response()
    response.status_code = 200
    frames = [f"data: {json.dumps(chunk)}\n\n" for chunk in chunks]
    if done:
        frames.append("data: [DONE]\n\n")
    response._content = "".join(frames).encode()
    response._content_consumed = True
    return response


def openai_text_response(text="ok", reason="stop"):
    return sse_response([
        {"choices": [{"index": 0, "delta": {"content": text}, "finish_reason": reason}]},
        {"choices": [], "usage": {"prompt_tokens": 11, "completion_tokens": 7}},
    ])
