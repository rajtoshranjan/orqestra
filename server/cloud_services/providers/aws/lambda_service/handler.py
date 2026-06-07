from cloud_services.base import BaseServiceHandler
from cloud_services.registry import registry

from .serializers import LambdaConfigSerializer
from .services import normalize_environment_variables


class LambdaHandler(BaseServiceHandler):
    """
    Handler for AWS Lambda function service.
    """

    @property
    def service_id(self) -> str:
        return "lambda"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Lambda::Function"

    @property
    def display_name(self) -> str:
        return "AWS Lambda"

    def get_serializer_class(self):
        return LambdaConfigSerializer

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Lambda configuration, including visual network, storage, and IAM dependencies.
        """
        problems = []
        data = node.get("data", {})
        config = data.get("config", {})
        node_name = self._fallback_node_name(node)
        edges = edges or []
        nodes = nodes or []

        if not config.get("function_name", "").strip():
            problems.append(f"Lambda {node_name} is missing a function name.")

        package_type = config.get("package_type", "Zip")
        if package_type == "Zip":
            if not config.get("runtime", "").strip():
                problems.append(f"Lambda {node_name} is missing a runtime.")
            if not config.get("handler", "").strip():
                problems.append(f"Lambda {node_name} is missing a handler.")
            if not config.get("code", "").strip():
                problems.append(f"Lambda {node_name} is missing inline code.")
        else:
            if not config.get("image_uri", "").strip():
                # Check if connected to ECR
                ecr_connected = False
                for edge in edges:
                    if (
                        edge.get("source") == node["id"]
                        or edge.get("target") == node["id"]
                    ):
                        conn_id = (
                            edge["source"]
                            if edge["target"] == node["id"]
                            else edge["target"]
                        )
                        for n in nodes:
                            if (
                                n["id"] == conn_id
                                and n.get("data", {}).get("service_id") == "ecr"
                            ):
                                ecr_connected = True
                if not ecr_connected:
                    problems.append(
                        f"Lambda {node_name} uses container deployment but has no Image URI or ECR Repository connected."
                    )

        memory_size = config.get("memory_size", 0)
        if memory_size < 128 or memory_size > 10240:
            problems.append(
                f"Lambda {node_name} has an invalid memory size (must be 128-10240 MB)."
            )

        timeout = config.get("timeout", 0)
        if timeout < 1 or timeout > 900:
            problems.append(
                f"Lambda {node_name} has an invalid timeout (must be 1-900 seconds)."
            )

        # Visual IAM check
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                conn_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes:
                    if (
                        n["id"] == conn_id
                        and n.get("data", {}).get("service_id") == "iam-role"
                    ):
                        pass

        # VPC/Subnets security checks
        def find_ancestor_by_service_id(node_id, service_id):
            current_id = node_id
            node_map = {n["id"]: n for n in nodes}
            while current_id:
                curr_node = node_map.get(current_id)
                if not curr_node:
                    break
                parent_id = curr_node.get("parentNode") or curr_node.get(
                    "data", {}
                ).get("config", {}).get("parentId")
                if parent_id:
                    parent_node = node_map.get(parent_id)
                    if (
                        parent_node
                        and parent_node.get("data", {}).get("service_id") == service_id
                    ):
                        return parent_node
                    current_id = parent_id
                else:
                    break
            return None

        has_subnets = False
        has_security_groups = False

        # Check ancestor subnet
        ancestor_subnet = find_ancestor_by_service_id(node["id"], "subnet")
        if ancestor_subnet:
            has_subnets = True
            sub_type = (
                ancestor_subnet.get("data", {})
                .get("config", {})
                .get("subnet_type", "private")
            )
            if sub_type == "public":
                problems.append(
                    f"WARNING: Lambda {node_name} is placed in a public subnet '{ancestor_subnet.get('data', {}).get('label')}'. Lambda functions should be hosted in private subnets for security."
                )

        # Check connection edges
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                conn_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes:
                    if n["id"] == conn_id:
                        svc_id = n.get("data", {}).get("service_id")
                        if svc_id == "subnet" and not ancestor_subnet:
                            has_subnets = True
                            sub_type = (
                                n.get("data", {})
                                .get("config", {})
                                .get("subnet_type", "private")
                            )
                            if sub_type == "public":
                                problems.append(
                                    f"WARNING: Lambda {node_name} is connected to a public subnet '{n.get('data', {}).get('label')}'. Lambda functions should be hosted in private subnets for security."
                                )
                        elif svc_id == "security-group":
                            has_security_groups = True

        # EFS mounts checks
        efs_connected = False
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                conn_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes:
                    if (
                        n["id"] == conn_id
                        and n.get("data", {}).get("service_id") == "efs"
                    ):
                        efs_connected = True

        if efs_connected and not (has_subnets and has_security_groups):
            problems.append(
                f"Lambda {node_name} is connected to EFS but lacks VPC subnet or security group connections (VPC configuration is required for EFS mounts)."
            )

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build Lambda plan details.
        """
        data = node.get("data", {})
        config = data.get("config", {})
        env_vars = normalize_environment_variables(
            config.get("environment_variables", [])
        )

        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("function_name", ""),
            "runtime": config.get("runtime", "container"),
            "memory_size": config.get("memory_size", 128),
            "timeout": config.get("timeout", 3),
            "environment_variable_count": len(env_vars),
            "connection_count": connection_count,
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """Generate OpenTofu aws_lambda_function resource from a node with relationships."""
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])
        env_vars = normalize_environment_variables(
            config.get("environment_variables", [])
        )
        edges = edges or []
        nodes = nodes or []

        # Find visual IAM role
        role_logical = None
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                conn_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes:
                    if (
                        n["id"] == conn_id
                        and n.get("data", {}).get("service_id") == "iam-role"
                    ):
                        role_logical = self.sanitize_resource_name(n["id"])

        role_arn = (
            f"${{aws_iam_role.{role_logical}.arn}}"
            if role_logical
            else settings.get("execution_role_arn", "")
        )

        resource_config = {
            "function_name": config["function_name"],
            "memory_size": config.get("memory_size", 128),
            "timeout": config.get("timeout", 3),
            "role": role_arn,
        }

        # Handle Zip vs Container packages
        package_type = config.get("package_type", "Zip")
        if package_type == "Zip":
            resource_config["runtime"] = config["runtime"]
            resource_config["handler"] = config["handler"]
            resource_config["filename"] = f"bundles/{logical_name}.zip"
        else:
            resource_config["package_type"] = "Image"

            # Resolve connected ECR Repository URL
            ecr_logical = None
            for edge in edges:
                if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                    conn_id = (
                        edge["source"]
                        if edge["target"] == node["id"]
                        else edge["target"]
                    )
                    for n in nodes:
                        if (
                            n["id"] == conn_id
                            and n.get("data", {}).get("service_id") == "ecr"
                        ):
                            ecr_logical = self.sanitize_resource_name(n["id"])

            if ecr_logical:
                tag = config.get("image_tag", "latest") or "latest"
                resource_config[
                    "image_uri"
                ] = f"${{aws_ecr_repository.{ecr_logical}.repository_url}}:{tag}"
            else:
                resource_config["image_uri"] = config.get("image_uri", "")

        # Ephemeral Storage
        ephemeral = config.get("ephemeral_storage", 512)
        if ephemeral > 512:
            resource_config["ephemeral_storage"] = {"size": ephemeral}

        # SnapStart
        if config.get("snap_start") == "PublishedVersions":
            resource_config["snap_start"] = {"apply_on": "PublishedVersions"}

        # Tracing Mode
        if config.get("tracing_mode") == "Active":
            resource_config["tracing_config"] = {"mode": "Active"}

        # Environment variables
        if env_vars:
            resource_config["environment"] = [{"variables": env_vars}]

        description = config.get("description", "").strip()
        if description:
            resource_config["description"] = description

        # Resolve connected subnets and security groups (VPC configuration)
        def find_ancestor_by_service_id(node_id, service_id):
            current_id = node_id
            node_map = {n["id"]: n for n in nodes}
            while current_id:
                curr_node = node_map.get(current_id)
                if not curr_node:
                    break
                parent_id = curr_node.get("parentNode") or curr_node.get(
                    "data", {}
                ).get("config", {}).get("parentId")
                if parent_id:
                    parent_node = node_map.get(parent_id)
                    if (
                        parent_node
                        and parent_node.get("data", {}).get("service_id") == service_id
                    ):
                        return parent_node
                    current_id = parent_id
                else:
                    break
            return None

        subnet_ids = []
        ancestor_subnet = find_ancestor_by_service_id(node["id"], "subnet")
        if ancestor_subnet:
            subnet_ids.append(ancestor_subnet["id"])

        sg_ids = []
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                conn_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes:
                    if n["id"] == conn_id:
                        svc_id = n.get("data", {}).get("service_id")
                        if svc_id == "subnet":
                            if n["id"] not in subnet_ids:
                                subnet_ids.append(n["id"])
                        elif svc_id == "security-group":
                            if n["id"] not in sg_ids:
                                sg_ids.append(n["id"])

        subnet_logicals = [self.sanitize_resource_name(sub) for sub in subnet_ids]
        sg_logicals = [self.sanitize_resource_name(sg) for sg in sg_ids]

        if subnet_logicals and sg_logicals:
            resource_config["vpc_config"] = {
                "subnet_ids": [f"${{aws_subnet.{sub}.id}}" for sub in subnet_logicals],
                "security_group_ids": [
                    f"${{aws_security_group.{sg}.id}}" for sg in sg_logicals
                ],
            }

        # Resolve connected Lambda Layers
        layer_logicals = []
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                conn_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes:
                    if (
                        n["id"] == conn_id
                        and n.get("data", {}).get("service_id") == "lambda-layer"
                    ):
                        layer_logicals.append(self.sanitize_resource_name(n["id"]))

        if layer_logicals:
            resource_config["layers"] = [
                f"${{aws_lambda_layer_version.{layer}.arn}}" for layer in layer_logicals
            ]

        # Resolve connected EFS Mounts
        efs_logical = None
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                conn_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes:
                    if (
                        n["id"] == conn_id
                        and n.get("data", {}).get("service_id") == "efs"
                    ):
                        efs_logical = self.sanitize_resource_name(n["id"])

        if efs_logical:
            # Mount the first access point
            resource_config["file_system_config"] = {
                "arn": f"${{aws_efs_access_point.{efs_logical}_ap_0.arn}}",
                "local_mount_path": "/mnt/efs",
            }

        # Top-level resource blocks
        res = {"aws_lambda_function": {logical_name: resource_config}}

        # Function URL Integration
        if config.get("enable_function_url"):
            res["aws_lambda_function_url"] = {
                f"{logical_name}_url": {
                    "function_name": f"${{aws_lambda_function.{logical_name}.function_name}}",
                    "authorization_type": config.get("function_url_auth_type", "NONE"),
                }
            }

        # Provisioned Concurrency Integration
        p_concurrency = config.get("provisioned_concurrency")
        if p_concurrency is not None and p_concurrency > 0:
            res["aws_lambda_provisioned_concurrency_config"] = {
                f"{logical_name}_concurrency": {
                    "function_name": f"${{aws_lambda_function.{logical_name}.function_name}}",
                    "qualifier": "1",
                    "provisioned_concurrent_executions": p_concurrency,
                }
            }

        # CloudWatch Log Group with Custom Retention
        log_retention = config.get("log_retention", 14)
        if log_retention:
            res["aws_cloudwatch_log_group"] = {
                f"lambda_log_{logical_name}": {
                    "name": f"/aws/lambda/{config['function_name']}",
                    "retention_in_days": log_retention,
                }
            }

        return {"resource": res}

    def _fallback_node_name(self, node):
        """Return the best available name for a node."""
        data = node.get("data", {})
        name = data.get("config", {}).get("function_name", "").strip()
        if name:
            return name
        node_id = node.get("id", "").strip()
        if node_id:
            return node_id
        return "unknown"


# Auto-register handler when this module is imported.
registry.register(LambdaHandler())
