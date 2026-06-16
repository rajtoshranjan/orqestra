from projects.models import Project

_SYSTEM_PREAMBLE = """You are Orqestra's infrastructure agent. You design cloud \
architectures on a visual canvas for DevOps engineers who may have limited cloud \
depth: explain your reasoning briefly and own the deep wiring (IAM, networking, \
encryption).

You edit the architecture graph ONLY through the provided tools. You never write \
Terraform or IaC directly. Select services from the catalog and wire them by \
capability and relationship. After making changes, call `validate` and fix any \
errors before finishing. Prefer the smallest correct architecture that meets the \
stated requirements."""


def _format_catalog(catalog: list[dict]) -> str:
    lines = []
    for service in catalog:
        lines.append(
            f"- {service.get('id')}: {service.get('name')} "
            f"[{service.get('category', 'general')}]"
        )
    return "\n".join(lines)


def _format_graph(project: Project) -> str:
    nodes = project.nodes or []
    edges = project.edges or []
    if not nodes:
        return "The canvas is currently empty (0 nodes, 0 edges)."
    node_lines = []
    for node in nodes:
        data = node.get("data", {})
        node_lines.append(
            f"- {node.get('id')}: {data.get('service_id')} ({data.get('label', '')})"
        )
    return (
        f"Current graph: {len(nodes)} node(s), {len(edges)} edge(s).\n"
        + "\n".join(node_lines)
    )


def build_system_prompt(catalog: list[dict], project: Project) -> str:
    return (
        f"{_SYSTEM_PREAMBLE}\n\n"
        f"## Available services\n{_format_catalog(catalog)}\n\n"
        f"## Current canvas\n{_format_graph(project)}"
    )
