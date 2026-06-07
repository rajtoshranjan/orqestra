from cloud_services.providers.aws.base import BaseAWSHandler
from cloud_services.registry import registry


class APIGatewayHandler(BaseAWSHandler):
    """
    Handler for AWS API Gateway service.
    """

    @property
    def service_id(self) -> str:
        return "api-gateway"

    @property
    def cloud_formation_type(self) -> str:
        return "AWS::ApiGatewayV2::Api"

    @property
    def display_name(self) -> str:
        return "AWS API Gateway"

    def validate(self, node: dict, nodes: list = None, edges: list = None) -> list[str]:
        """
        Validate API Gateway configuration.
        """
        problems = []
        config = node.get("data", {}).get("config", {})
        if not config.get("api_name"):
            problems.append(
                f"API Gateway {self._fallback_node_name(node)} requires an API name."
            )
        return problems

    def build_plan_resource(self, node: dict, connection_count: int) -> dict:
        """
        Build planning details for an API Gateway.
        """
        config = node.get("data", {}).get("config", {})
        return {
            "id": node["id"],
            "type": self.cloud_formation_type,
            "name": config.get("api_name", "API Gateway"),
            "connection_count": connection_count,
            "details": [
                {"label": "Type", "value": config.get("api_type", "HTTP")},
                {"label": "Routes", "value": str(len(config.get("routes", [])))},
            ],
        }

    def to_tofu_resource(
        self, node: dict, settings: dict, nodes: list = None, edges: list = None
    ) -> dict:
        """
        Generate OpenTofu representation for an API Gateway, resolving connected Lambdas.
        """
        config = node["data"]["config"]
        logical_name = self.sanitize_resource_name(node["id"])
        api_type = config.get("api_type", "HTTP")

        # Basic API setup.
        res = {
            "aws_apigatewayv2_api": {
                logical_name: {
                    "name": config.get("api_name", "api"),
                    "protocol_type": "HTTP" if api_type != "WEBSOCKET" else "WEBSOCKET",
                }
            },
            "aws_apigatewayv2_stage": {
                f"{logical_name}_stage": {
                    "api_id": f"${{aws_apigatewayv2_api.{logical_name}.id}}",
                    "name": config.get("stage_name", "dev"),
                    "auto_deploy": True,
                }
            },
        }

        # Resolve connected Lambdas.
        connected_lambdas = []
        for edge in edges or []:
            if edge.get("source") == node["id"] or edge.get("target") == node["id"]:
                connected_id = (
                    edge["source"] if edge["target"] == node["id"] else edge["target"]
                )
                for n in nodes or []:
                    if (
                        n["id"] == connected_id
                        and n.get("data", {}).get("service_id") == "lambda"
                    ):
                        connected_lambdas.append(self.sanitize_resource_name(n["id"]))

        # For each route, set up route, integration, and grant invocation permissions to connected lambdas.
        for i, route in enumerate(config.get("routes", [])):
            route_key = f"{route.get('method', 'GET')} {route.get('path', '/hello')}"
            route_logical = f"{logical_name}_route_{i}"
            integration_logical = f"{logical_name}_integration_{i}"

            if "aws_apigatewayv2_route" not in res:
                res["aws_apigatewayv2_route"] = {}
            if "aws_apigatewayv2_integration" not in res:
                res["aws_apigatewayv2_integration"] = {}

            # Integrate with the first connected lambda by default, or fallback.
            target_lambda = connected_lambdas[0] if connected_lambdas else None
            if target_lambda:
                res["aws_apigatewayv2_integration"][integration_logical] = {
                    "api_id": f"${{aws_apigatewayv2_api.{logical_name}.id}}",
                    "integration_type": "AWS_PROXY",
                    "integration_uri": f"${{aws_lambda_function.{target_lambda}.invoke_arn}}",
                    "payload_format_version": "2.0",
                }

                res["aws_apigatewayv2_route"][route_logical] = {
                    "api_id": f"${{aws_apigatewayv2_api.{logical_name}.id}}",
                    "route_key": route_key,
                    "target": f"integrations/${{aws_apigatewayv2_integration.{integration_logical}.id}}",
                }

                # Grant permission.
                perm_logical = f"apigw_perm_{logical_name}_{target_lambda}_{i}"
                if "aws_lambda_permission" not in res:
                    res["aws_lambda_permission"] = {}
                res["aws_lambda_permission"][perm_logical] = {
                    "statement_id": f"AllowAPIGatewayInvoke_{perm_logical}",
                    "action": "lambda:InvokeFunction",
                    "function_name": f"${{aws_lambda_function.{target_lambda}.function_name}}",
                    "principal": "apigateway.amazonaws.com",
                    "source_arn": f"${{aws_apigatewayv2_api.{logical_name}.execution_arn}}/*/*",
                }

        return {"resource": res}


registry.register(APIGatewayHandler())
