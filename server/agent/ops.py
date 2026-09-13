"""Human-readable descriptions of graph ops, derived from a run.

Kept server-side so agent-authored text is always something the run itself
produced — a comment carrying the agent's name is never assembled by a caller.
"""

from .constants import RiskLevel
from .models import AgentRun


def _label_map(run: AgentRun) -> dict[str, str]:
    """Node id -> display label, from the project's persisted graph."""
    labels: dict[str, str] = {}
    for node in run.conversation.project.nodes or []:
        data = node.get("data") or {}
        node_id = node.get("id")
        if node_id:
            labels[node_id] = (
                data.get("label")
                or data.get("service_id")
                or data.get("serviceId")
                or node_id
            )
    return labels


def describe_op(op: dict, labels: dict[str, str]) -> str:
    """Imperative description of one pending op."""
    op_input = op.get("input") or {}
    name = op.get("name")

    def label(key: str) -> str:
        value = str(op_input.get(key) or "")
        return labels.get(value, value)

    if name == "remove":
        return f"remove {label('target_id')}"
    if name == "add_resource":
        service = op_input.get("service_id") or "a resource"
        explicit = op_input.get("label")
        return f'add {service} "{explicit}"' if explicit else f"add {service}"
    if name == "configure":
        fields = ", ".join((op_input.get("config_patch") or {}).keys())
        target = label("node_id")
        return f"change {fields} on {target}" if fields else f"reconfigure {target}"
    if name == "connect":
        return f"connect {label('source_id')} to {label('target_id')}"
    if name == "set_parent":
        parent = op_input.get("parent_id")
        node = label("node_id")
        return (
            f"move {node} into {labels.get(str(parent), parent)}"
            if parent
            else f"move {node} to the top level"
        )
    return str(name)


def describe_pending_confirmation(run: AgentRun) -> str:
    """The question a paused run asks in its thread."""
    pending = [
        op for op in run.outstanding_ops() if op.get("risk") == RiskLevel.CONFIRM.value
    ]
    if not pending:
        return run.narration()

    labels = _label_map(run)
    described = "; ".join(describe_op(op, labels) for op in pending)
    narration = run.narration()
    lead = f"{narration}\n\n" if narration else ""
    return (
        f"{lead}Before I go ahead I need you to confirm: {described}. "
        'Reply "yes" and I\'ll apply it, or tell me what to do instead.'
    )
