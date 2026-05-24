from rest_framework.test import APITestCase


class BaseTestCase(APITestCase):
    """
    Base test case providing setup and helper utilities for draw-to-deploy tests.
    """

    def _make_valid_lambda_node(self, node_id="node-1", function_name="my-func"):
        """Helper to create a valid Lambda diagram node payload."""
        return {
            "id": node_id,
            "type": "lambda",
            "data": {
                "kind": "lambda",
                "label": "Lambda",
                "config": {
                    "function_name": function_name,
                    "runtime": "nodejs20.x",
                    "handler": "index.handler",
                    "code": "exports.handler = async () => ({ statusCode: 200 });",
                    "environment_variables": [],
                    "memory_size": 128,
                    "timeout": 3,
                    "description": "Test function",
                },
            },
        }
