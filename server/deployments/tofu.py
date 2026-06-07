import hashlib
import json
import logging

from cloud_services.registry import registry

logger = logging.getLogger(__name__)


def build_tofu_config(nodes: list, edges: list, settings: dict) -> dict:
    """
    Build a complete OpenTofu configuration from the canvas graph.

    Iterates over all nodes, delegates to each handler's to_tofu_resource()
    method, and assembles a complete .tf.json configuration.

    Returns a dict ready to be serialized to JSON and written as main.tf.json.
    """
    region = settings.get("region", "us-east-1") or "us-east-1"

    config = {
        "terraform": {
            "required_providers": {
                "aws": {
                    "source": "hashicorp/aws",
                    "version": "~> 5.0",
                }
            }
        },
        "provider": {
            "aws": {
                "region": region,
            }
        },
        "resource": {},
    }

    # Merge endpoint URL for local dev (ministack/localstack).
    endpoint_url = settings.get("endpoint_url", "")
    if endpoint_url:
        config["provider"]["aws"]["endpoints"] = [
            {
                "lambda": endpoint_url,
                "iam": endpoint_url,
                "s3": endpoint_url,
                "dynamodb": endpoint_url,
                "sqs": endpoint_url,
                "sns": endpoint_url,
                "apigateway": endpoint_url,
            }
        ]
        config["provider"]["aws"]["skip_credentials_validation"] = True
        config["provider"]["aws"]["skip_metadata_api_check"] = True
        config["provider"]["aws"]["skip_requesting_account_id"] = True
        config["provider"]["aws"]["s3_use_path_style"] = True

    for node in nodes:
        data = node.get("data", {})
        service_id = data.get("service_id", data.get("kind", ""))
        if not service_id:
            continue

        if not registry.is_registered(service_id):
            logger.warning(
                "Skipping unregistered service '%s' in tofu config.", service_id
            )
            continue

        handler = registry.get(service_id)
        resource_block = handler.to_tofu_resource(node, settings, nodes, edges)

        # Merge the resource block into the top-level config.
        for resource_type, resources in resource_block.get("resource", {}).items():
            if resource_type not in config["resource"]:
                config["resource"][resource_type] = {}
            config["resource"][resource_type].update(resources)

    return config


def compute_graph_hash(nodes: list, edges: list, settings: dict) -> str:
    """
    Compute a deterministic hash of the graph for dirty-checking.

    Used to detect whether the canvas has changed since the last deployment.
    """
    payload = {
        "nodes": _normalize_nodes_for_hash(nodes),
        "edges": _normalize_edges_for_hash(edges),
        "settings": settings,
    }
    raw = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def _normalize_nodes_for_hash(nodes: list) -> list:
    """Extract only deployment-relevant fields from nodes for hashing."""
    normalized = []
    for node in nodes:
        data = node.get("data", {})
        normalized.append(
            {
                "id": node.get("id"),
                "service_id": data.get("service_id", data.get("kind", "")),
                "config": data.get("config", {}),
            }
        )
    return sorted(normalized, key=lambda item: item.get("id", ""))


def _normalize_edges_for_hash(edges: list) -> list:
    """Extract only deployment-relevant fields from edges for hashing."""
    normalized = []
    for edge in edges:
        normalized.append(
            {
                "source": edge.get("source"),
                "target": edge.get("target"),
            }
        )
    return sorted(
        normalized, key=lambda item: (item.get("source", ""), item.get("target", ""))
    )
