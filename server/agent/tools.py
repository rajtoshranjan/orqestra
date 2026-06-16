from .llm.types import ToolSpec

GRAPH_OP_NAMES = [
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
                    "service_id": {"type": "string", "description": "Registry service id, e.g. 'lambda'."},
                    "label": {"type": "string", "description": "Human-readable node label."},
                    "config": {"type": "object", "description": "Resource configuration values."},
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
