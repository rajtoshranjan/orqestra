from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class EFSHandler(BaseAWSHandler):
    """
    Handler for AWS EFS service.
    """

    @property
    def service_id(self) -> str:
        return "efs"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::EFS::FileSystem"

    @property
    def display_name(self) -> str:
        return "Amazon EFS"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate EFS File System configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("creation_token"):
            problems.append(
                f"EFS File System {self._fallback_node_name(node)} requires a token."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for EFS.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("creation_token", "EFS"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Performance",
                    "value": config.get("performance_mode", "generalPurpose"),
                },
                {
                    "label": "Throughput",
                    "value": config.get("throughput_mode", "bursting"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for EFS.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])

        res = {
            "aws_efs_file_system": {
                logical_name: {
                    "creation_token": config.get("creation_token", "efs"),
                    "encrypted": config.get("encrypted", True),
                    "performance_mode": config.get(
                        "performance_mode", "generalPurpose"
                    ),
                    "throughput_mode": config.get("throughput_mode", "bursting"),
                }
            }
        }

        if config.get("throughput_mode") == "provisioned" and config.get(
            "provisioned_throughput_in_mibps"
        ):
            res["aws_efs_file_system"][logical_name][
                "provisioned_throughput_in_mibps"
            ] = config["provisioned_throughput_in_mibps"]

        # If connected subnets are found, create mount targets.
        subnets = []
        for edge in edges or []:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                connected_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes or []:
                    if (
                        n["id"] == connected_id
                        and n.get("data", {}).get("service_id") == "subnet"
                    ):
                        subnets.append(self.sanitize_resource_name(n["id"]))

        for subnet in subnets:
            target_name = f"{logical_name}_mount_{subnet}"
            if "aws_efs_mount_target" not in res:
                res["aws_efs_mount_target"] = {}
            res["aws_efs_mount_target"][target_name] = {
                "file_system_id": f"${{aws_efs_file_system.{logical_name}.id}}",
                "subnet_id": f"${{aws_subnet.{subnet}.id}}",
            }

        # Access points.
        for i, ap in enumerate(config.get("access_points", [])):
            ap_name = f"{logical_name}_ap_{i}"
            if "aws_efs_access_point" not in res:
                res["aws_efs_access_point"] = {}
            res["aws_efs_access_point"][ap_name] = {
                "file_system_id": f"${{aws_efs_file_system.{logical_name}.id}}",
                "root_directory": {"path": ap.get("path", "/lambda")},
            }

        return {"resource": res}


registry.register(EFSHandler())
