import json

from .llm.types import ToolSpec

GRAPH_OPERATION_NAMES = [
    "list_services",
    "get_service",
    "query_graph",
    "add_resource",
    "connect",
    "configure",
    "set_parent",
    "remove",
    "validate",
    "estimate_cost",
]


def graph_tool_specs() -> list[ToolSpec]:
    return [
        ToolSpec(
            name="list_services",
            description=(
                "List available cloud services from the catalog, optionally filtered "
                "by category. Use this to discover what resources you can add."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Optional category filter, e.g. 'compute', 'storage'.",
                    }
                },
            },
        ),
        ToolSpec(
            name="get_service",
            description="Get the full definition for one service, including its capabilities and allowed relationships.",
            input_schema={
                "type": "object",
                "properties": {"service_id": {"type": "string"}},
                "required": ["service_id"],
            },
        ),
        ToolSpec(
            name="query_graph",
            description="Return the current graph: every node (id, service, label) and edge.",
            input_schema={"type": "object", "properties": {}},
        ),
        ToolSpec(
            name="add_resource",
            description="Add a cloud resource node to the canvas.",
            input_schema={
                "type": "object",
                "properties": {
                    "service_id": {
                        "type": "string",
                        "description": "Registry service id, e.g. 'lambda'.",
                    },
                    "label": {
                        "type": "string",
                        "description": "Human-readable node label.",
                    },
                    "config": {
                        "type": "object",
                        "description": "Resource configuration values.",
                    },
                    "parent_id": {
                        "type": ["string", "null"],
                        "description": "Container node id this resource nests inside, if any.",
                    },
                },
                "required": ["service_id"],
            },
        ),
        ToolSpec(
            name="connect",
            description="Create a typed relationship edge between two nodes.",
            input_schema={
                "type": "object",
                "properties": {
                    "source_id": {"type": "string"},
                    "target_id": {"type": "string"},
                    "relationship_kind": {
                        "type": "string",
                        "description": "e.g. 'invokes', 'reads-from', 'assumes-role'.",
                    },
                },
                "required": ["source_id", "target_id", "relationship_kind"],
            },
        ),
        ToolSpec(
            name="configure",
            description="Patch the configuration of an existing node.",
            input_schema={
                "type": "object",
                "properties": {
                    "node_id": {"type": "string"},
                    "config_patch": {"type": "object"},
                },
                "required": ["node_id", "config_patch"],
            },
        ),
        ToolSpec(
            name="set_parent",
            description="Move a node into (or out of) a container node.",
            input_schema={
                "type": "object",
                "properties": {
                    "node_id": {"type": "string"},
                    "parent_id": {"type": ["string", "null"]},
                },
                "required": ["node_id"],
            },
        ),
        ToolSpec(
            name="remove",
            description="Delete a node or an edge by id.",
            input_schema={
                "type": "object",
                "properties": {"target_id": {"type": "string"}},
                "required": ["target_id"],
            },
        ),
        ToolSpec(
            name="validate",
            description="Run validation over the whole graph and return any errors.",
            input_schema={"type": "object", "properties": {}},
        ),
        ToolSpec(
            name="estimate_cost",
            description="Return the current estimated monthly cost of the graph.",
            input_schema={"type": "object", "properties": {}},
        ),
    ]


# --- Server-resolved reads -------------------------------------------------
#
# These operations have no side effects and read data the server already holds: the
# catalog snapshot on the conversation, and the graph posted with the request.
# Resolving them here keeps a lookup from costing an HTTP round trip plus a
# whole extra model turn against AGENT_MAX_TURNS.
#
# `validate` and `estimate_cost` stay on the client: they need the frontend
# service registry's validators and cost estimators, which have no server twin.

SERVER_RESOLVED_OPERATIONS = frozenset({"list_services", "get_service", "query_graph"})

CLIENT_OPERATION_NAMES = [name for name in GRAPH_OPERATION_NAMES if name not in SERVER_RESOLVED_OPERATIONS]


def _service_line(service: dict) -> str:
    """One compact line carrying everything needed to choose and wire a service."""
    capabilities = service.get("capabilities") or {}
    name = service.get("name")
    head = f"{service.get('id')} ({service.get('category', 'general')})"
    if name and name != service.get("id"):
        head = f'{head} "{name}"'
    parts = [head]

    provides = capabilities.get("provides")
    requires = capabilities.get("requires")
    parents = service.get("allowedParents") or service.get("allowed_parents")
    relationships = service.get("allowedRelationships") or service.get(
        "allowed_relationships"
    )

    if requires:
        parts.append(f"needs={','.join(requires)}")
    if provides:
        parts.append(f"provides={','.join(provides)}")
    if parents:
        parts.append(f"parents={','.join(parents)}")
    if relationships:
        parts.append(f"connects={','.join(relationships)}")
    if service.get("isContainer") or service.get("is_container"):
        parts.append("container")

    summary = service.get("summary") or service.get("role")
    line = " | ".join(parts)
    return f"{line} — {summary}" if summary else line


def service_catalog_lines(catalog: list[dict]) -> list[str]:
    """One line per service, carrying everything needed to choose and wire it."""
    return [_service_line(service) for service in catalog]


def _list_services(operation_input: dict, catalog: list[dict]) -> str:
    category = operation_input.get("category")
    services = [
        service
        for service in catalog
        if not category or service.get("category") == category
    ]
    if not services:
        if category:
            return (
                f"No services in category '{category}'. "
                "Call list_services with no category to see every category."
            )
        return "The service catalog is empty."
    return "\n".join(_service_line(service) for service in services)


def _get_service(operation_input: dict, catalog: list[dict]) -> tuple[str, bool]:
    service_id = str(operation_input.get("service_id") or "")
    for service in catalog:
        if service.get("id") == service_id:
            return json.dumps(service), False
    known = ", ".join(str(service.get("id")) for service in catalog[:20])
    return (f'Unknown service_id "{service_id}". Known ids include: {known}.', True)


def _query_graph(nodes: list[dict], edges: list[dict]) -> str:
    return json.dumps(
        {
            "nodes": [
                {
                    "id": node.get("id"),
                    "service_id": (node.get("data") or {}).get("service_id")
                    or (node.get("data") or {}).get("serviceId"),
                    "label": (node.get("data") or {}).get("label"),
                    "parent": node.get("parent_node") or node.get("parentNode"),
                }
                for node in nodes
            ],
            "edges": [
                {
                    "id": edge.get("id"),
                    "source": edge.get("source"),
                    "target": edge.get("target"),
                    "relationship_kind": (edge.get("data") or {}).get(
                        "relationship_kind"
                    )
                    or (edge.get("data") or {}).get("relationshipKind"),
                }
                for edge in edges
            ],
        }
    )


def resolve_read_operation(
    operation_name: str,
    operation_input: dict,
    catalog: list[dict],
    nodes: list[dict],
    edges: list[dict],
) -> tuple[str, bool]:
    """Answer a read-only operation server-side. Returns (content, is_error)."""
    if operation_name == "list_services":
        return _list_services(operation_input or {}, catalog), False
    if operation_name == "get_service":
        return _get_service(operation_input or {}, catalog)
    if operation_name == "query_graph":
        return _query_graph(nodes, edges), False
    raise ValueError(f"{operation_name} is not server-resolvable.")
