from .registry import registry


def plan_diagram(nodes, edges) -> list[dict]:
    """
    Build a deployment plan by delegating to each node's service handler.
    """
    resources = []

    # Pre-compute connection counts in O(N+E).
    connection_counts = {}
    for edge in edges:
        source = edge.get("source", "")
        target = edge.get("target", "")
        connection_counts[source] = connection_counts.get(source, 0) + 1
        connection_counts[target] = connection_counts.get(target, 0) + 1

    for node in nodes:
        data = node.get("data", {})
        service_id = data.get("service_id", data.get("kind", ""))
        if not service_id:
            continue

        try:
            handler = registry.get(service_id)
            node_id = node.get("id")
            connection_count = connection_counts.get(node_id, 0)
            resource_summary = handler.build_plan_resource(node, connection_count)
            resources.append(resource_summary)
        except ValueError:
            # Skip unregistered/unsupported services or let validation handle it.
            pass

    return resources
