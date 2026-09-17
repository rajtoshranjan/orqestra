from collections.abc import Callable
from dataclasses import dataclass, field

from orqestra.env_variables import EnvVariable

from .constants import (
    AGENT_MESSAGE,
    AGENT_OPERATION_APPLIED,
    AGENT_RUN_COMPLETED,
    AGENT_RUN_FAILED,
    AGENT_TOOL_CALL,
    TRUNCATION_STOP_REASONS,
    MessageRole,
    RiskLevel,
    RunStatus,
)
from .llm.base import BaseLLMProvider
from .llm.types import (
    LLMMessage,
    Role,
    Stop,
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
from .prompts import build_catalog_block, build_system_prompt
from .risk import classify_operation_risk
from .tools import SERVER_RESOLVED_OPERATIONS, graph_tool_specs, resolve_read_operation

EventSink = Callable[[str, dict], None]

# Rough characters-per-token used to budget replayed history. Deliberately
# conservative: over-estimating tokens trims a little more history than strictly
# necessary, which is far cheaper than a hard context-window rejection.
CHARS_PER_TOKEN = 3.5

# Share of the provider's context window history may occupy. The rest is left
# for the system prompt (catalog + canvas) and the model's own output.
HISTORY_CONTEXT_SHARE = 0.5


def _noop_sink(event_type: str, payload: dict) -> None:
    pass


_ROLE_TO_CANONICAL = {
    MessageRole.USER.value: Role.USER,
    MessageRole.ASSISTANT.value: Role.ASSISTANT,
    MessageRole.TOOL.value: Role.TOOL,
}


def _repair_history(history: list[LLMMessage]) -> list[LLMMessage]:
    """Drop unmatched tool_use / tool_result blocks and empty messages.

    An abandoned run (client closed the panel, disconnected, etc.) can leave an
    assistant `tool_use` block with no matching `tool_result` — replaying that
    verbatim makes the LLM API reject the whole request and permanently poisons
    the conversation. Keep a tool call only when its result also exists (and vice
    versa); drop any message left empty.

    A message with no content at all is dropped for the same reason: providers
    reject an empty content array, and older conversations may already carry one
    from a model turn that returned nothing.
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
    pairs_satisfied = matched == (tool_use_ids | tool_result_ids)
    if pairs_satisfied and all(message.content for message in history):
        return history  # every pair is satisfied and nothing is empty

    repaired: list[LLMMessage] = []
    for message in history:
        blocks: list = []
        for block in message.content:
            if isinstance(block, ToolCallBlock) and block.id not in matched:
                continue
            if isinstance(block, ToolResultBlock) and block.tool_call_id not in matched:
                continue
            blocks.append(block)
        if blocks:
            repaired.append(LLMMessage(role=message.role, content=blocks))
    return repaired


def _message_cost(message: LLMMessage) -> int:
    """Approximate token cost of one message, for history budgeting."""
    characters = 0
    for block in message.content:
        if isinstance(block, TextBlock):
            characters += len(block.text)
        elif isinstance(block, ToolCallBlock):
            characters += len(block.name) + len(str(block.input))
        elif isinstance(block, ToolResultBlock):
            characters += len(block.content)
    return int(characters / CHARS_PER_TOKEN) + 8


def _budget_history(history: list[LLMMessage], max_tokens: int) -> list[LLMMessage]:
    """Keep the opening request and the most recent turns within a token budget.

    Long runs otherwise replay every previous turn on every request, so cost and
    latency grow quadratically and a long build chat eventually exceeds the
    window and fails with a raw provider error. The first user message carries
    the task itself, so it is always kept; the middle is dropped oldest-first.
    `_repair_history` then cleans up any tool pair the trim broke.
    """
    if not history:
        return history

    total = sum(_message_cost(message) for message in history)
    if total <= max_tokens:
        return history

    head = history[:1]
    budget = max_tokens - _message_cost(head[0])
    tail: list[LLMMessage] = []
    for message in reversed(history[1:]):
        cost = _message_cost(message)
        if cost > budget:
            break
        budget -= cost
        tail.append(message)
    tail.reverse()
    return head + tail


@dataclass
class OperationRequest:
    tool_call_id: str
    name: str
    input: dict
    risk: str


@dataclass
class AdvanceResult:
    operations: list[OperationRequest] = field(default_factory=list)
    assistant_text: str = ""
    run_status: str = RunStatus.RUNNING.value


@dataclass
class _TurnOutcome:
    text: str
    tool_calls: list[ToolCallRequested]
    input_tokens: int
    output_tokens: int
    stop_reason: str


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
            max_turns
            if max_turns is not None
            else int(EnvVariable.AGENT_MAX_TURNS.value)
        )

    def advance(
        self,
        run: AgentRun,
        operation_results: list[dict],
        catalog: list[dict],
        graph: dict | None = None,
    ) -> AdvanceResult:
        if run.is_terminal:
            # Cancelled or already finished: never call the provider again.
            return AdvanceResult(
                operations=[], assistant_text="", run_status=run.status
            )

        conversation = run.conversation
        nodes, edges = self._resolve_graph(conversation, graph)

        # 1. Ingest the previous turn's tool results as a TOOL message. Results
        #    the server resolved itself are merged in ahead of the client's, so
        #    the message answers every outstanding tool call in one block.
        pending = list(run.resolved_results or [])
        merged_results = pending + list(operation_results)
        if merged_results:
            self._persist_tool_results(conversation, merged_results, run)
            if pending:
                run.resolved_results = []
                run.save(update_fields=["resolved_results", "updated_at"])
            for item in merged_results:
                self.emit(
                    AGENT_OPERATION_APPLIED,
                    {"run_id": str(run.id), "tool_call_id": item["tool_call_id"]},
                )

        # 2. Take model turns. Turns that only ask for server-resolvable reads
        #    are answered here and looped, so a lookup never costs a round trip.
        #    The catalog block is stable across the whole run, so it is handed to
        #    the provider separately as a prompt-cache breakpoint.
        catalog_block = build_catalog_block(catalog)
        narration: list[str] = []
        while True:
            if run.turn_count >= self.max_turns:
                return self._fail(
                    run,
                    f"Exceeded the maximum of {self.max_turns} steps for one request. "
                    "Ask for a smaller change, or continue in a new message.",
                    assistant_text="".join(narration),
                )

            system_prompt = build_system_prompt(catalog, nodes, edges)
            history = self._load_history(conversation)

            try:
                turn = self._run_turn(run, system_prompt, history, catalog_block)
            except Exception as error:  # noqa: BLE001 - surface provider failures
                return self._fail(
                    run,
                    f"The model provider failed: {error}",
                    assistant_text="".join(narration),
                )

            if turn.stop_reason in TRUNCATION_STOP_REASONS:
                return self._fail(
                    run,
                    "The model's response was truncated before it finished. "
                    "Try a smaller request, or raise AGENT_MAX_OUTPUT_TOKENS.",
                    assistant_text="".join(narration),
                )

            blocks: list = []
            if turn.text:
                blocks.append(TextBlock(text=turn.text))
            for call in turn.tool_calls:
                blocks.append(
                    ToolCallBlock(id=call.id, name=call.name, input=call.input)
                )

            if not blocks:
                # Persisting content=[] would poison the conversation forever:
                # providers reject an empty content block on every later replay.
                return self._fail(
                    run,
                    "The model returned an empty response. Please try again.",
                    assistant_text="".join(narration),
                )

            AgentMessage.objects.create(
                conversation=conversation,
                run=run,
                role=MessageRole.ASSISTANT.value,
                content=content_blocks_to_json(blocks),
                input_tokens=turn.input_tokens,
                output_tokens=turn.output_tokens,
            )
            run.turn_count += 1
            run.input_tokens += turn.input_tokens
            run.output_tokens += turn.output_tokens
            if turn.text:
                narration.append(turn.text)

            if not turn.tool_calls:
                return self._complete(run, "".join(narration))

            server_calls = [
                call
                for call in turn.tool_calls
                if call.name in SERVER_RESOLVED_OPERATIONS
            ]
            client_calls = [
                call
                for call in turn.tool_calls
                if call.name not in SERVER_RESOLVED_OPERATIONS
            ]
            server_results = [
                self._resolve_read(run, call, catalog, nodes, edges)
                for call in server_calls
            ]

            if client_calls:
                return self._await_client(
                    run, client_calls, server_results, "".join(narration)
                )

            # Every call was a read: answer it and take another turn right away.
            self._persist_tool_results(conversation, server_results, run)
            run.save(
                update_fields=[
                    "turn_count",
                    "input_tokens",
                    "output_tokens",
                    "updated_at",
                ]
            )

    # --- turn helpers -------------------------------------------------------

    def _run_turn(
        self,
        run: AgentRun,
        system_prompt: str,
        history: list[LLMMessage],
        cacheable_prefix: str = "",
    ) -> _TurnOutcome:
        text_parts: list[str] = []
        tool_calls: list[ToolCallRequested] = []
        input_tokens = output_tokens = 0
        stop_reason = ""

        for event in self.provider.stream(
            system_prompt=system_prompt,
            messages=history,
            tools=graph_tool_specs(),
            max_tokens=int(EnvVariable.AGENT_MAX_OUTPUT_TOKENS.value),
            cacheable_prefix=cacheable_prefix,
        ):
            if isinstance(event, TextDelta):
                text_parts.append(event.text)
            elif isinstance(event, ToolCallRequested):
                tool_calls.append(event)
            elif isinstance(event, Usage):
                input_tokens = event.input_tokens
                output_tokens = event.output_tokens
            elif isinstance(event, Stop):
                stop_reason = (event.reason or "").lower()

        # One event per turn, not one per token. Emitting per delta put a
        # channel-layer round trip on the hot path for every token, into a group
        # shared with other subscribers and consumed by none of them.
        text = "".join(text_parts)
        if text:
            self.emit(AGENT_MESSAGE, {"run_id": str(run.id), "text": text})

        return _TurnOutcome(
            text=text,
            tool_calls=tool_calls,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            stop_reason=stop_reason,
        )

    def _resolve_read(
        self,
        run: AgentRun,
        call: ToolCallRequested,
        catalog: list[dict],
        nodes: list[dict],
        edges: list[dict],
    ) -> dict:
        """Answer a read-only operation here rather than paying a client round trip."""
        try:
            content, is_error = resolve_read_operation(
                call.name, call.input or {}, catalog, nodes, edges
            )
        except Exception as error:  # noqa: BLE001 - a bad read must not fail the run
            content, is_error = f"{call.name} failed: {error}", True
        self.emit(
            AGENT_TOOL_CALL,
            {
                "run_id": str(run.id),
                "tool_call_id": call.id,
                "name": call.name,
                "input": call.input,
                "risk": RiskLevel.SAFE.value,
            },
        )
        return {"tool_call_id": call.id, "content": content, "is_error": is_error}

    @staticmethod
    def _persist_tool_results(conversation, results: list[dict], run) -> None:
        blocks = [
            ToolResultBlock(
                tool_call_id=item["tool_call_id"],
                content=item.get("content") or "(no output)",
                is_error=bool(item.get("is_error", False)),
            )
            for item in results
        ]
        AgentMessage.objects.create(
            conversation=conversation,
            run=run,
            role=MessageRole.TOOL.value,
            content=content_blocks_to_json(blocks),
        )

    @staticmethod
    def _resolve_graph(conversation, graph: dict | None) -> tuple[list, list]:
        """Prefer the client's live canvas snapshot; fall back to the project."""
        if graph is not None:
            return graph.get("nodes") or [], graph.get("edges") or []
        project = conversation.project
        return project.nodes or [], project.edges or []

    def _load_history(self, conversation) -> list[LLMMessage]:
        history: list[LLMMessage] = []
        for message in conversation.messages.all():
            history.append(
                LLMMessage(
                    role=_ROLE_TO_CANONICAL[message.role],
                    content=json_to_content_blocks(message.content),
                )
            )
        budget = int(
            self.provider.capabilities.max_context_tokens * HISTORY_CONTEXT_SHARE
        )
        return _repair_history(_budget_history(history, budget))

    # --- terminal states ----------------------------------------------------

    def _await_client(
        self,
        run: AgentRun,
        calls: list[ToolCallRequested],
        resolved_results: list[dict],
        assistant_text: str,
    ) -> AdvanceResult:
        operations = [
            OperationRequest(
                tool_call_id=call.id,
                name=call.name,
                input=call.input,
                risk=classify_operation_risk(call.name, call.input).value,
            )
            for call in calls
        ]
        for operation in operations:
            self.emit(
                AGENT_TOOL_CALL,
                {
                    "run_id": str(run.id),
                    "tool_call_id": operation.tool_call_id,
                    "name": operation.name,
                    "input": operation.input,
                    "risk": operation.risk,
                },
            )
        run.status = RunStatus.AWAITING_CLIENT.value
        run.resolved_results = resolved_results
        run.save(
            update_fields=[
                "status",
                "resolved_results",
                "turn_count",
                "input_tokens",
                "output_tokens",
                "updated_at",
            ]
        )
        return AdvanceResult(
            operations=operations, assistant_text=assistant_text, run_status=run.status
        )

    def _complete(self, run: AgentRun, assistant_text: str) -> AdvanceResult:
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
            operations=[], assistant_text=assistant_text, run_status=run.status
        )

    def _fail(
        self, run: AgentRun, error: str, assistant_text: str = ""
    ) -> AdvanceResult:
        run.status = RunStatus.FAILED.value
        run.error = error
        run.save(
            update_fields=[
                "status",
                "error",
                "turn_count",
                "input_tokens",
                "output_tokens",
                "updated_at",
            ]
        )
        self.emit(AGENT_RUN_FAILED, {"run_id": str(run.id), "error": error})
        return AdvanceResult(
            operations=[], assistant_text=assistant_text, run_status=run.status
        )
