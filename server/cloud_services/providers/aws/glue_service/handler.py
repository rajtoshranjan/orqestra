from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class GlueHandler(BaseAWSHandler):
    """
    Handler for AWS Glue Data Catalog and Crawler services.
    """

    @property
    def service_id(self) -> str:
        return "glue"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::Glue::Crawler"

    @property
    def display_name(self) -> str:
        return "AWS Glue"

    @property
    def resource_family(self) -> str:
        return "general"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate Glue configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("databaseName", "").strip():
            problems.append(f"Glue {node_name} is missing a database name.")
        if not config.get("crawlerName", "").strip():
            problems.append(f"Glue {node_name} is missing a crawler name.")

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build Glue planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("crawlerName", "Glue Crawler"),
            "connection_count": connection_count,
            "details": [
                {"label": "Database Name", "value": config.get("databaseName", "")},
                {"label": "Data Source", "value": config.get("dataSourceType", "S3")},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for Glue.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "glue"))
        role_arn = settings.get(
            "execution_role_arn", "arn:aws:iam::123456789012:role/GlueExecutionRole"
        )

        edges = edges or []
        nodes = nodes or []
        s3_targets = []

        # Find if connected to S3
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                connected_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for other_node in nodes:
                    if (
                        other_node["id"] == connected_id
                        and other_node.get("data", {}).get("service_id") == "s3"
                    ):
                        s3_logical = self.sanitize_resource_name(other_node["id"])
                        s3_targets.append(
                            {
                                "path": f"s3://${{aws_s3_bucket.{s3_logical}.bucket}}",
                            }
                        )

        if not s3_targets:
            s3_targets.append(
                {
                    "path": "s3://default-glue-target-bucket/",
                }
            )

        return {
            "resource": {
                "aws_glue_catalog_database": {
                    logical_name: {
                        "name": config.get("databaseName", ""),
                    }
                },
                "aws_glue_crawler": {
                    logical_name: {
                        "name": config.get("crawlerName", ""),
                        "database_name": f"${{aws_glue_catalog_database.{logical_name}.name}}",
                        "role": role_arn,
                        "s3_target": s3_targets,
                        "tags": {
                            "Name": config.get("crawlerName", "glue-crawler"),
                        },
                    }
                },
            }
        }


# Auto-register handler when this module is imported.
registry.register(GlueHandler())
