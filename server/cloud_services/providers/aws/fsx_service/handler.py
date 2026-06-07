from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class FSxHandler(BaseAWSHandler):
    """
    Handler for Amazon FSx File System service.
    """

    @property
    def service_id(self) -> str:
        return "fsx"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::FSx::FileSystem"

    @property
    def display_name(self) -> str:
        return "Amazon FSx"

    @property
    def resource_family(self) -> str:
        return "storage"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate FSx File System configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_label = self._fallback_node_name(node)
        if not config.get("file_system_name"):
            problems.append(
                f"FSx File System {node_label} requires a file system name."
            )
        storage_capacity = config.get("storage_capacity_gb", 0)
        if int(storage_capacity) < 1:
            problems.append(
                f"FSx File System {node_label} requires a storage capacity of at least 1 GiB."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an FSx File System.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("file_system_name", "FSx File System"),
            "connection_count": connection_count,
            "details": [
                {"label": "Type", "value": config.get("file_system_type", "LUSTRE")},
                {
                    "label": "Capacity",
                    "value": f"{config.get('storage_capacity_gb', 1200)} GiB",
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an FSx Lustre File System.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "resource"))
        return {
            "resource": {
                "aws_fsx_lustre_file_system": {
                    logical_name: {
                        "storage_capacity": config.get("storage_capacity_gb", 1200),
                        "subnet_ids": ["SUBNET_ID_PLACEHOLDER"],
                    }
                }
            }
        }


registry.register(FSxHandler())
