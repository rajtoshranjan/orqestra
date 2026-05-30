from .registry import registry


def plan_diagram(nodes, edges) -> list[dict]:
    """
    Build a deployment plan by delegating to each node's service handler.
    """
    resources = []

    for node in nodes:
        data = node.get("data", {})
        service_id = data.get("service_id", data.get("kind", ""))
        if not service_id:
            continue

        try:
            handler = registry.get(service_id)

            # Count connections (edges where this node is source or target).
            node_id = node.get("id")
            connection_count = sum(
                1
                for edge in edges
                if edge.get("source") == node_id or edge.get("target") == node_id
            )

            resource_summary = handler.build_plan_resource(node, connection_count)
            resources.append(resource_summary)
        except ValueError:
            # Skip unregistered/unsupported services or let validation handle it.
            pass

    return resources


def deploy_diagram(nodes, edges, settings, logs) -> list[dict]:
    """
    Deploy all resources in the diagram by delegating to their handlers.
    Appends deployment logs to the provided logs list.
    """
    # Add general validation or start info.
    logs.append(
        {
            "level": "info",
            "message": f"Validated {len(nodes)} resource(s).",
        }
    )
    logs.append(
        {
            "level": "info",
            "message": (
                f"Connections are visual-only in this version, so {len(edges)} "
                f"edge(s) will not affect deployment order."
            ),
        }
    )

    for node in nodes:
        data = node.get("data", {})
        service_id = data.get("service_id", data.get("kind", ""))
        if not service_id:
            continue

        handler = registry.get(service_id)
        handler.deploy(node, settings, logs)

    return logs
