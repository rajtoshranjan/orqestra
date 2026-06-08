from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class CloudFrontHandler(BaseAWSHandler):
    """
    Handler for Amazon CloudFront Distribution service.
    """

    @property
    def service_id(self) -> str:
        return "cloudfront"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::CloudFront::Distribution"

    @property
    def display_name(self) -> str:
        return "Amazon CloudFront"

    @property
    def resource_family(self) -> str:
        return "networking"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate CloudFront Distribution configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        node_name = self._fallback_node_name(node)

        if not config.get("distributionName", "").strip():
            problems.append(
                f"CloudFront Distribution {node_name} is missing a distribution name."
            )

        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build CloudFront planning details.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("distributionName", "CloudFront Distribution"),
            "connection_count": connection_count,
            "details": [
                {
                    "label": "Price Class",
                    "value": config.get("priceClass", "PriceClass_100"),
                },
                {
                    "label": "Viewer Protocol Policy",
                    "value": config.get("viewerProtocolPolicy", "redirect-to-https"),
                },
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for CloudFront Distribution, with automatic origin resolution.
        """
        config = node.get("data", {}).get("config", {})
        logical_name = self.sanitize_resource_name(node.get("id", "cloudfront"))

        edges = edges or []
        nodes = nodes or []
        origins = []

        # Find connected origins (S3 Buckets or ALBs)
        for edge in edges:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                connected_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for other_node in nodes:
                    if other_node["id"] == connected_id:
                        svc_id = other_node.get("data", {}).get("service_id")
                        if svc_id == "s3":
                            s3_logical = self.sanitize_resource_name(other_node["id"])
                            origins.append(
                                {
                                    "domain_name": f"${{aws_s3_bucket.{s3_logical}.bucket_regional_domain_name}}",
                                    "origin_id": s3_logical,
                                    "s3_origin_config": {},
                                }
                            )
                        elif svc_id == "alb":
                            alb_logical = self.sanitize_resource_name(other_node["id"])
                            origins.append(
                                {
                                    "domain_name": f"${{aws_lb.{alb_logical}.dns_name}}",
                                    "origin_id": alb_logical,
                                    "custom_origin_config": {
                                        "http_port": 80,
                                        "https_port": 443,
                                        "origin_protocol_policy": "https-only",
                                        "origin_ssl_protocols": ["TLSv1.2"],
                                    },
                                }
                            )

        # Fallback default origin
        if not origins:
            origins.append(
                {
                    "domain_name": "example.com",
                    "origin_id": "default-origin",
                    "custom_origin_config": {
                        "http_port": 80,
                        "https_port": 443,
                        "origin_protocol_policy": "http-only",
                        "origin_ssl_protocols": ["TLSv1.2"],
                    },
                }
            )

        return {
            "resource": {
                "aws_cloudfront_distribution": {
                    logical_name: {
                        "enabled": True,
                        "origin": origins,
                        "price_class": config.get("priceClass", "PriceClass_100"),
                        "default_cache_behavior": {
                            "allowed_methods": ["GET", "HEAD"],
                            "cached_methods": ["GET", "HEAD"],
                            "target_origin_id": origins[0]["origin_id"],
                            "viewer_protocol_policy": config.get(
                                "viewerProtocolPolicy", "redirect-to-https"
                            ),
                            "forwarded_values": {
                                "query_string": False,
                                "cookies": {"forward": "none"},
                            },
                        },
                        "restrictions": {
                            "geo_restriction": {
                                "restriction_type": "none",
                            }
                        },
                        "viewer_certificate": {
                            "cloudfront_default_certificate": True,
                        },
                        "tags": {
                            "Name": config.get(
                                "distributionName", "cloudfront-distribution"
                            ),
                        },
                    }
                }
            }
        }


# Auto-register handler when this module is imported.
registry.register(CloudFrontHandler())
