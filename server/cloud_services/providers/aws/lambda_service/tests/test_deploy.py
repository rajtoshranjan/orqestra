from orqestra.tests import BaseTestCase


class DeployTests(BaseTestCase):

    def test_deploy_empty_diagram(self):
        payload = {
            "diagram": {
                "nodes": [],
                "edges": [],
                "deployment_settings": {"region": "", "execution_role_arn": ""},
                "last_saved_at": "",
            }
        }
        response = self.client.post("/api/deploy", payload, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertIn("error", response.data)

    def test_deploy_invalid_config(self):
        payload = {
            "diagram": {
                "nodes": [
                    {
                        "id": "node-1",
                        "type": "lambda",
                        "data": {
                            "kind": "lambda",
                            "label": "Lambda",
                            "config": {
                                "function_name": "",
                                "runtime": "",
                                "handler": "",
                                "code": "",
                                "environment_variables": [],
                                "memory_size": 128,
                                "timeout": 3,
                                "description": "",
                            },
                        },
                    }
                ],
                "edges": [],
                "deployment_settings": {"region": "", "execution_role_arn": ""},
                "last_saved_at": "",
            }
        }
        response = self.client.post("/api/deploy", payload, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertIn("error", response.data)
        self.assertIn("logs", response.data)

    def test_deploy_get_not_allowed(self):
        response = self.client.get("/api/deploy")
        self.assertEqual(response.status_code, 405)

    def test_deploy_invalid_json(self):
        response = self.client.post(
            "/api/deploy",
            "not json",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
