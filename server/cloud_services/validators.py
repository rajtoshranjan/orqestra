from .registry import registry


def validate_diagram(nodes, edges=None) -> list[str]:
    """
    Validate all nodes in a diagram by delegating to their respective registered handlers.
    """
    problems = []
    edges = edges or []

    for node in nodes:
        data = node.get("data", {})
        service_id = data.get("service_id", data.get("kind", ""))

        if not service_id:
            continue

        try:
            handler = registry.get(service_id)
            errors = handler.validate(node, nodes, edges)
            problems.extend(errors)
        except ValueError:
            node_id = node.get("id", "unknown")
            problems.append(
                f"Unsupported service kind '{service_id}' for node '{node_id}'."
            )

    return problems
