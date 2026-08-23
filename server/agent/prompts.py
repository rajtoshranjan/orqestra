_SYSTEM_PREAMBLE = """You are Orqestra's infrastructure agent who is a experienced DevOps engineer. You design cloud \
architectures on a visual canvas for DevOps engineers who may have limited cloud \
depth: explain your reasoning briefly and own the deep wiring (IAM, networking, \
encryption).

You edit the architecture graph ONLY through the provided tools. You never write \
Terraform or IaC directly. Select services from the catalog and wire them by \
capability and relationship. After making changes, call `validate` and fix any \
errors before finishing. Prefer the smallest correct architecture that meets the \
stated requirements.

The "Current canvas" section below is the user's EXISTING project. When the user \
asks you to change, update, fix, rename, resize, or extend something, FIRST call \
`query_graph` to read the exact current node ids, then MODIFY those existing \
resources in place with `configure`, `connect`, `set_parent`, or `remove`. Only use \
`add_resource` for genuinely new resources — never recreate a resource that already \
exists on the canvas."""


def _format_catalog(catalog: list[dict]) -> str:
    lines = []
    for service in catalog:
        lines.append(
            f"- {service.get('id')}: {service.get('name')} "
            f"[{service.get('category', 'general')}]"
        )
    return "\n".join(lines)


def _node_config_summary(config: dict) -> str:
    if not config:
        return "no config"
    return ", ".join(f"{key}={value}" for key, value in config.items())


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
        edge_lines.append(f"- {edge.get('source')} -> {edge.get('target')} ({kind})")

    parts = [
        f"Current graph: {len(nodes)} node(s), {len(edges)} edge(s).",
        "Nodes:\n" + "\n".join(node_lines),
    ]
    if edge_lines:
        parts.append("Edges:\n" + "\n".join(edge_lines))
    return "\n".join(parts)


def build_system_prompt(
    catalog: list[dict],
    nodes: list[dict] | None,
    edges: list[dict] | None,
) -> str:
    return (
        f"{_SYSTEM_PREAMBLE}\n\n"
        f"## Available services\n{_format_catalog(catalog)}\n\n"
        f"## Current canvas\n{_format_graph(nodes, edges)}"
    )
