from .tools import service_catalog_lines

_SYSTEM_PREAMBLE = """You are Orqestra's infrastructure agent, an experienced DevOps engineer. \
You design cloud architectures on a visual canvas for engineers who may have limited cloud \
depth: explain your reasoning briefly and own the deep wiring (IAM, networking, encryption).

You edit the architecture graph ONLY through the provided tools. You never write Terraform or \
IaC directly. Choose services by the capabilities they provide and require — never by guessing \
at a name — and wire them along the relationships each service allows. Prefer the smallest \
correct architecture that meets the stated requirements. After making changes, call `validate` \
and fix any errors before finishing.

Both sections below are authoritative and already current, so do not re-read them:

- "Available services" is the complete catalog. Every id, capability, allowed parent and \
allowed relationship you may use is listed. Call `get_service` only when you need a detail the \
listing omits, and `list_services` only to filter a large catalog by category.
- "Current canvas" is the user's existing project, with the exact node ids. When the user asks \
you to change, update, fix, rename, resize or extend something, MODIFY those existing resources \
in place with `configure`, `connect`, `set_parent` or `remove`. Use `add_resource` only for \
genuinely new resources — never recreate something already on the canvas.

Batch independent operations into a single turn rather than one per turn. Keep narration to a \
sentence or two per step: the user watches the canvas build, so say what you are doing and why, \
not what you are about to do."""

_CATALOG_LEGEND = (
    'Format: id (category) "name" | needs=<capabilities required> | '
    "provides=<capabilities offered> | parents=<services it may nest inside> | "
    "connects=<services it may link to> | container — summary"
)


def _node_config_summary(config: dict) -> str:
    if not config:
        return "no config"
    return ", ".join(f"{key}={value}" for key, value in config.items())


def _format_catalog(catalog: list[dict]) -> str:
    lines = service_catalog_lines(catalog)
    if not lines:
        return "The catalog is empty — no services are available."
    return f"{_CATALOG_LEGEND}\n\n" + "\n".join(lines)


def _format_graph(nodes: list[dict] | None, edges: list[dict] | None) -> str:
    nodes = nodes or []
    edges = edges or []
    if not nodes:
        return "The canvas is currently empty (0 nodes, 0 edges) — a brand-new project."

    node_lines = []
    for node in nodes:
        data = node.get("data", {}) or {}
        # Tolerate both persisted (snake_case) and live-client (camelCase) shapes.
        service_id = data.get("service_id") or data.get("serviceId")
        parent = node.get("parent_node") or node.get("parentNode")
        parent_str = f" parent={parent}" if parent else ""
        config = data.get("config") or {}
        node_lines.append(
            f"- id={node.get('id')} service={service_id} "
            f'label="{data.get("label", "")}"{parent_str} '
            f"({_node_config_summary(config)})"
        )

    edge_lines = []
    for edge in edges:
        data = edge.get("data", {}) or {}
        kind = (
            data.get("relationship_kind")
            or data.get("relationshipKind")
            or "related-to"
        )
        edge_lines.append(
            f"- id={edge.get('id')} {edge.get('source')} -> {edge.get('target')} ({kind})"
        )

    parts = [
        f"Current graph: {len(nodes)} node(s), {len(edges)} edge(s).",
        "Nodes:\n" + "\n".join(node_lines),
    ]
    if edge_lines:
        parts.append("Edges:\n" + "\n".join(edge_lines))
    return "\n".join(parts)


def build_catalog_block(catalog: list[dict]) -> str:
    """The static half of the prompt: identical on every turn of a run.

    Split out so providers that support prompt caching can mark it as a cache
    breakpoint — it is the single largest component and never changes mid-run.
    """
    return f"{_SYSTEM_PREAMBLE}\n\n## Available services\n{_format_catalog(catalog)}"


def build_system_prompt(
    catalog: list[dict],
    nodes: list[dict] | None,
    edges: list[dict] | None,
) -> str:
    return (
        f"{build_catalog_block(catalog)}\n\n"
        f"## Current canvas\n{_format_graph(nodes, edges)}"
    )
