import logging

import requests
from django.db import transaction
from django.utils import timezone
from orqestra.env_variables import EnvVariable
from projects.models import Project

from .models import (
    DeployedResource,
    Deployment,
    DeploymentStatus,
    ProjectDeploymentState,
)
from .tofu import build_tofu_config, compute_graph_hash

logger = logging.getLogger(__name__)


def create_deployment(project: Project) -> Deployment:
    """
    Create a new deployment for a project.

    Snapshots the current graph, generates the OpenTofu config,
    creates a Deployment record, and invokes the deployer.
    """
    nodes = project.nodes or []
    edges = project.edges or []
    settings = project.deployment_settings or {}

    graph_snapshot = {
        "nodes": nodes,
        "edges": edges,
        "settings": settings,
    }

    # Generate OpenTofu configuration.
    tofu_config = build_tofu_config(nodes, edges, settings)

    # Retrieve existing state if available.
    existing_state = _get_existing_tofu_state(project)

    deployment = Deployment.objects.create(
        project=project,
        status=DeploymentStatus.GENERATING,
        graph_snapshot=graph_snapshot,
        tofu_config=tofu_config,
        logs=[
            _log_entry("info", f"Deployment created for project '{project.name}'."),
            _log_entry(
                "info",
                f"Generated OpenTofu config with {len(tofu_config.get('resource', {}))} resource type(s).",
            ),
        ],
    )

    # Invoke the deployer asynchronously.
    try:
        invoke_deployer(deployment, existing_state)
        deployment.status = DeploymentStatus.INVOKING
        deployment.started_at = timezone.now()
        deployment.logs.append(_log_entry("info", "Deployer invoked successfully."))
        deployment.save(update_fields=["status", "started_at", "logs"])
    except Exception as exc:
        logger.exception("Failed to invoke deployer for deployment %s", deployment.id)
        deployment.status = DeploymentStatus.FAILED
        deployment.error_message = str(exc)
        deployment.completed_at = timezone.now()
        deployment.logs.append(_log_entry("error", f"Failed to invoke deployer: {exc}"))
        deployment.save(
            update_fields=["status", "error_message", "completed_at", "logs"]
        )

    return deployment


def invoke_deployer(deployment: Deployment, existing_state: dict | None) -> None:
    """
    Invoke the deployer service via HTTP.

    In local mode, calls the deployer container directly.
    In lambda mode, would invoke an AWS Lambda function.
    """
    mode = EnvVariable.DEPLOYER_MODE.value
    callback_url = (
        f"{EnvVariable.SERVER_BASE_URL.value}/deployments/{deployment.id}/callback/"
    )

    payload = {
        "deployment_id": str(deployment.id),
        "project_id": str(deployment.project_id),
        "tofu_config": deployment.tofu_config,
        "existing_state": existing_state,
        "callback_url": callback_url,
        "aws_credentials": _build_aws_credentials(deployment),
        "code_bundles": _build_code_bundles(deployment),
    }

    if mode == "local":
        deployer_url = f"{EnvVariable.DEPLOYER_LOCAL_URL.value}/deploy"
        response = requests.post(deployer_url, json=payload, timeout=10)
        if response.status_code not in (200, 202):
            raise RuntimeError(
                f"Deployer returned status {response.status_code}: {response.text}"
            )
    else:
        raise NotImplementedError(
            "Lambda invocation mode is not yet implemented. Use DEPLOYER_MODE=local."
        )


def process_deployment_callback(deployment_id: str, results: dict) -> Deployment:
    """
    Process the callback from the deployer.

    Updates the Deployment record and, on success, updates the
    ProjectDeploymentState.
    """
    deployment = Deployment.objects.select_related("project").get(id=deployment_id)

    status = results.get("status", "failed")
    deployer_logs = results.get("logs", [])
    tofu_state = results.get("tofu_state")
    plan_output = results.get("plan_output", "")
    error_message = results.get("error_message", "")
    outputs = results.get("outputs", {})

    with transaction.atomic():
        # Update deployment record.
        deployment.status = (
            DeploymentStatus.SUCCEEDED
            if status == "succeeded"
            else DeploymentStatus.FAILED
        )
        deployment.tofu_state = tofu_state
        deployment.tofu_plan_output = plan_output
        deployment.error_message = error_message
        deployment.completed_at = timezone.now()

        for log in deployer_logs:
            deployment.logs.append(log)

        deployment.save(
            update_fields=[
                "status",
                "tofu_state",
                "tofu_plan_output",
                "error_message",
                "completed_at",
                "logs",
            ]
        )

        # On success, update the project deployment state.
        if status == "succeeded":
            _update_project_state(deployment, tofu_state, outputs)

    return deployment


def _update_project_state(
    deployment: Deployment,
    tofu_state: dict | None,
    outputs: dict,
) -> None:
    """Update or create the ProjectDeploymentState after a successful deploy."""
    project = deployment.project
    graph = deployment.graph_snapshot

    state, _created = ProjectDeploymentState.objects.get_or_create(
        project=project,
        defaults={
            "last_deployment": deployment,
            "tofu_state": tofu_state,
            "deployed_graph_hash": compute_graph_hash(
                graph.get("nodes", []),
                graph.get("edges", []),
                graph.get("settings", {}),
            ),
            "last_deployed_at": timezone.now(),
        },
    )

    if not _created:
        state.last_deployment = deployment
        state.tofu_state = tofu_state
        state.deployed_graph_hash = compute_graph_hash(
            graph.get("nodes", []),
            graph.get("edges", []),
            graph.get("settings", {}),
        )
        state.last_deployed_at = timezone.now()
        state.save(
            update_fields=[
                "last_deployment",
                "tofu_state",
                "deployed_graph_hash",
                "last_deployed_at",
                "updated_at",
            ]
        )

    # Rebuild deployed resources from tofu state.
    _sync_deployed_resources(state, tofu_state)


def _sync_deployed_resources(
    state: ProjectDeploymentState,
    tofu_state: dict | None,
) -> None:
    """Parse the tofu state to extract deployed resources and sync them."""
    state.resources.all().delete()

    if not tofu_state:
        return

    resources = tofu_state.get("resources", [])
    for resource in resources:
        for instance in resource.get("instances", []):
            attributes = instance.get("attributes", {})
            DeployedResource.objects.create(
                deployment_state=state,
                node_id=resource.get("name", ""),
                service_id=_tofu_type_to_service_id(resource.get("type", "")),
                resource_identifier=attributes.get("arn", attributes.get("id", "")),
                config_hash="",
                status="active",
            )


def _get_existing_tofu_state(project: Project) -> dict | None:
    """Retrieve the existing OpenTofu state for a project, if any."""
    try:
        return project.deployment_state.tofu_state
    except ProjectDeploymentState.DoesNotExist:
        return None


def _build_aws_credentials(deployment: Deployment) -> dict:
    """Build AWS credentials dict from server environment for the deployer."""
    import os

    return {
        "access_key_id": os.environ.get("AWS_ACCESS_KEY_ID", ""),
        "secret_access_key": os.environ.get("AWS_SECRET_ACCESS_KEY", ""),
        "region": deployment.graph_snapshot.get("settings", {}).get(
            "region", "us-east-1"
        )
        or "us-east-1",
        "endpoint_url": os.environ.get("AWS_ENDPOINT_URL", ""),
    }


def _build_code_bundles(deployment: Deployment) -> dict:
    """
    Build code bundles for resources that require inline code packaging.

    Returns a dict mapping logical resource names to their source code content.
    """
    bundles = {}
    nodes = deployment.graph_snapshot.get("nodes", [])

    for node in nodes:
        data = node.get("data", {})
        service_id = data.get("service_id", data.get("kind", ""))
        config = data.get("config", {})

        if service_id == "lambda" and config.get("code", "").strip():
            pass

            # Use the sanitize method from any handler instance for name generation.
            from cloud_services.registry import registry

            handler = registry.get(service_id)
            logical_name = handler.sanitize_resource_name(node["id"])
            bundles[logical_name] = {
                "code": config["code"],
                "runtime": config.get("runtime", ""),
                "handler": config.get("handler", ""),
            }

    return bundles


def _tofu_type_to_service_id(tofu_type: str) -> str:
    """Map a Terraform resource type to our service ID."""
    mapping = {
        "aws_lambda_function": "lambda",
    }
    return mapping.get(tofu_type, tofu_type)


def _log_entry(level: str, message: str) -> dict:
    """Create a structured log entry dict."""
    return {
        "level": level,
        "message": message,
        "timestamp": timezone.now().isoformat(),
    }
