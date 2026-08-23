from collections.abc import Callable
from dataclasses import dataclass, field

from django.conf import settings

from .constants import (
    AGENT_MESSAGE_DELTA,
    AGENT_OP_APPLIED,
    AGENT_RUN_COMPLETED,
    AGENT_RUN_FAILED,
    AGENT_TOOL_CALL,
    MessageRole,
    RunStatus,
)
from .llm.base import BaseLLMProvider
from .llm.types import (
    LLMMessage,
    Role,
    TextBlock,
    TextDelta,
    ToolCallBlock,
    ToolCallRequested,
    ToolResultBlock,
    Usage,
    content_blocks_to_json,
    json_to_content_blocks,
)
from .models import AgentMessage, AgentRun
from .prompts import build_system_prompt
from .risk import classify_op_risk
from .tools import graph_tool_specs

EventSink = Callable[[str, dict], None]


def _noop_sink(event_type: str, payload: dict) -> None:
    pass


_ROLE_TO_CANONICAL = {
    MessageRole.USER.value: Role.USER,
    MessageRole.ASSISTANT.value: Role.ASSISTANT,
    MessageRole.TOOL.value: Role.TOOL,
}


def _repair_history(history: list[LLMMessage]) -> list[LLMMessage]:
    """Drop unmatched tool_use / tool_result blocks.

    An abandoned run (client closed the panel, disconnected, etc.) can leave an
    assistant `tool_use` block with no matching `tool_result` — replaying that
    verbatim makes the LLM API reject the whole request and permanently poisons
    the conversation. Keep a tool call only when its result also exists (and vice
    versa); drop any message left empty.
    """
    tool_use_ids = {
        block.id
        for message in history
        for block in message.content
        if isinstance(block, ToolCallBlock)
    }
    tool_result_ids = {
        block.tool_call_id
        for message in history
        for block in message.content
        if isinstance(block, ToolResultBlock)
    }
    matched = tool_use_ids & tool_result_ids
    if matched == (tool_use_ids | tool_result_ids):
        return history  # every pair is satisfied; nothing to repair

    repaired: list[LLMMessage] = []
    for message in history:
        blocks: list = []
        for block in message.content:
            if isinstance(block, ToolCallBlock) and block.id not in matched:
                continue
            if (
                isinstance(block, ToolResultBlock)
                and block.tool_call_id not in matched
            ):
                continue
            blocks.append(block)
        if blocks:
            repaired.append(LLMMessage(role=message.role, content=blocks))
    return repaired


@dataclass
class OpRequest:
    tool_call_id: str
    name: str
    input: dict
    risk: str


@dataclass
class AdvanceResult:
    ops: list[OpRequest] = field(default_factory=list)
    assistant_text: str = ""
    run_status: str = RunStatus.RUNNING.value


class AgentEngine:
    def __init__(
        self,
        provider: BaseLLMProvider,
        event_sink: EventSink | None = None,
        max_turns: int | None = None,
    ):
        self.provider = provider
        self.emit = event_sink or _noop_sink
        self.max_turns = (
            max_turns if max_turns is not None else settings.AGENT_MAX_TURNS
        )

    def advance(
        self,
        run: AgentRun,
        op_results: list[dict],
        catalog: list[dict],
        graph: dict | None = None,
    ) -> AdvanceResult:
        if run.turn_count >= self.max_turns:
            return self._fail(run, f"Exceeded max turns ({self.max_turns}).")

        conversation = run.conversation

        # 1. Ingest the previous turn's tool results as a TOOL message.
        if op_results:
            tool_blocks = [
                ToolResultBlock(
                    tool_call_id=item["tool_call_id"],
                    content=item.get("content", ""),
                    is_error=item.get("is_error", False),
                )
                for item in op_results
            ]
            AgentMessage.objects.create(
                conversation=conversation,
                role=MessageRole.TOOL.value,
                content=content_blocks_to_json(tool_blocks),
            )
            for item in op_results:
                self.emit(
                    AGENT_OP_APPLIED,
                    {"run_id": str(run.id), "tool_call_id": item["tool_call_id"]},
                )

        # 2. Rebuild the canonical message history.
        history = self._load_history(conversation)
        # Prefer the client's live canvas snapshot (exactly what the user sees);
        # fall back to the persisted project graph when it isn't supplied.
        if graph is not None:
            nodes = graph.get("nodes") or []
            edges = graph.get("edges") or []
        else:
            project = conversation.project
            nodes = project.nodes or []
            edges = project.edges or []
        system_prompt = build_system_prompt(catalog, nodes, edges)

        # 3. Run one model turn, accumulating text + tool calls.
        text_parts: list[str] = []
        tool_calls: list[ToolCallRequested] = []
        input_tokens = output_tokens = 0

        try:
            for event in self.provider.stream(
                system_prompt=system_prompt, messages=history, tools=graph_tool_specs()
            ):
                if isinstance(event, TextDelta):
                    text_parts.append(event.text)
                    self.emit(
                        AGENT_MESSAGE_DELTA, {"run_id": str(run.id), "text": event.text}
                    )
                elif isinstance(event, ToolCallRequested):
                    tool_calls.append(event)
                elif isinstance(event, Usage):
                    input_tokens = event.input_tokens
                    output_tokens = event.output_tokens
        except Exception as error:  # noqa: BLE001 - surface provider failures as a failed run
            return self._fail(run, f"LLM provider error: {error}")

        assistant_text = "".join(text_parts)

        # 4. Persist the assistant message.
        blocks = []
        if assistant_text:
            blocks.append(TextBlock(text=assistant_text))
        for call in tool_calls:
            blocks.append(ToolCallBlock(id=call.id, name=call.name, input=call.input))
        AgentMessage.objects.create(
            conversation=conversation,
            role=MessageRole.ASSISTANT.value,
            content=content_blocks_to_json(blocks),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

        # 5. Update run accounting.
        run.turn_count += 1
        run.input_tokens += input_tokens
        run.output_tokens += output_tokens

        # 6. Classify ops and decide next state.
        if tool_calls:
            ops = [
                OpRequest(
                    tool_call_id=call.id,
                    name=call.name,
                    input=call.input,
                    risk=classify_op_risk(call.name, call.input).value,
                )
                for call in tool_calls
            ]
            for op in ops:
                self.emit(
                    AGENT_TOOL_CALL,
                    {
                        "run_id": str(run.id),
                        "tool_call_id": op.tool_call_id,
                        "name": op.name,
                        "input": op.input,
                        "risk": op.risk,
                    },
                )
            run.status = RunStatus.AWAITING_CLIENT.value
            run.save(
                update_fields=[
                    "status",
                    "turn_count",
                    "input_tokens",
                    "output_tokens",
                    "updated_at",
                ]
            )
            return AdvanceResult(
                ops=ops, assistant_text=assistant_text, run_status=run.status
            )

        run.status = RunStatus.COMPLETED.value
        run.save(
            update_fields=[
                "status",
                "turn_count",
                "input_tokens",
                "output_tokens",
                "updated_at",
            ]
        )
        self.emit(
            AGENT_RUN_COMPLETED,
            {
                "run_id": str(run.id),
                "input_tokens": run.input_tokens,
                "output_tokens": run.output_tokens,
            },
        )
        return AdvanceResult(
            ops=[], assistant_text=assistant_text, run_status=run.status
        )

    def _load_history(self, conversation) -> list[LLMMessage]:
        history: list[LLMMessage] = []
        for message in conversation.messages.all():
            history.append(
                LLMMessage(
                    role=_ROLE_TO_CANONICAL[message.role],
                    content=json_to_content_blocks(message.content),
                )
            )
        return _repair_history(history)

    def _fail(self, run: AgentRun, error: str) -> AdvanceResult:
        run.status = RunStatus.FAILED.value
        run.error = error
        run.save(update_fields=["status", "error", "updated_at"])
        self.emit(AGENT_RUN_FAILED, {"run_id": str(run.id), "error": error})
        return AdvanceResult(ops=[], assistant_text="", run_status=run.status)
