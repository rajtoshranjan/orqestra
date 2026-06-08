from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class MSKHandler(BaseAWSHandler):
    """
    Handler for Amazon MSK Cluster service.
    """

    @property
    def service_id(self) -> str:
        return "msk"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::MSK::Cluster"

    @property
    def display_name(self) -> str:
        return "Amazon MSK"

    @property
    def resource_family(self) -> str:
        return "messaging"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate MSK Cluster configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("clusterName", "").strip():
            problems.append(f"MSK Cluster {node_name} is missing a cluster name.")
        if not config.get("kafkaVersion", "").strip():
            problems.append(f"MSK Cluster {node_name} is missing a Kafka version.")
        if not config.get("brokerInstanceType", "").strip():
            problems.append(
                f"MSK Cluster {node_name} is missing a broker instance type."
            )
        broker_count = config.get("brokerCount", 0)
        if int(broker_count) < 1:
            problems.append(
                f"MSK Cluster {node_name} must have at least 1 broker node."
            )

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build MSK planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("clusterName", "MSK Cluster"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Kafka Version",
                    "value": config.get("kafkaVersion", "3.6.0"),
                },
                {"label": "Broker Type", "value": config.get("brokerInstanceType", "")},
                {"label": "Broker Count", "value": str(config.get("brokerCount", 3))},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for MSK Cluster.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "msk"))

        edges = edges or []
        nodes = nodes or []
        subnets = []
        security_groups = []

        # Find connected subnets and security groups
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                connected_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for other_node in nodes:
                    if other_node["id"] == connected_id:
                        svc_id = other_node.get("data", {}).get("service_id")
                        if svc_id == "subnet":
                            subnets.append(
                                self.sanitize_resource_name(other_node["id"])
                            )
                        elif svc_id == "security-group":
                            security_groups.append(
                                self.sanitize_resource_name(other_node["id"])
                            )

        # Build broker node group info
        broker_node_group = {
            "instance_type": config.get("brokerInstanceType", "kafka.t3.small"),
        }
        if subnets:
            broker_node_group["client_subnets"] = [
                f"${{aws_subnet.{sub}.id}}" for sub in subnets
            ]
        else:
            broker_node_group["client_subnets"] = ["${aws_subnet.subnet_1.id}"]

        if security_groups:
            broker_node_group["security_groups"] = [
                f"${{aws_security_group.{sg}.id}}" for sg in security_groups
            ]
        else:
            broker_node_group["security_groups"] = ["${aws_security_group.sg_1.id}"]

        return {
            "resource": {
                "aws_msk_cluster": {
                    logical_name: {
                        "cluster_name": config.get("clusterName", ""),
                        "kafka_version": config.get("kafkaVersion", "3.6.0"),
                        "number_of_broker_nodes": int(config.get("brokerCount", 3)),
                        "broker_node_group_info": broker_node_group,
                        "tags": {
                            "Name": config.get("clusterName", "msk-cluster"),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(MSKHandler())
