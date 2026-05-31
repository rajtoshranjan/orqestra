from orqestra.tests import BaseTestCase


class PlanTests(BaseTestCase):
    def test_plan_valid_diagram(self):
        payload = {
            "diagram": {
                "nodes": [self._make_valid_lambda_node()],
                "edges": [],
                "deployment_settings": {
                    "region": "us-east-1",
                    "execution_role_arn": "",
                },
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertEqual(len(response.data["resources"]), 1)
        self.assertEqual(response.data["resources"][0]["name"], "my-func")

    def test_plan_invalid_missing_function_name(self):
        node = self._make_valid_lambda_node()
        node["data"]["config"]["function_name"] = ""
        payload = {
            "diagram": {
                "nodes": [node],
                "edges": [],
                "deployment_settings": {"region": "", "execution_role_arn": ""},
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertFalse(response.data["valid"])
        self.assertTrue(len(response.data["errors"]) > 0)

    def test_plan_counts_connections(self):
        payload = {
            "diagram": {
                "nodes": [
                    self._make_valid_lambda_node("n1", "func-a"),
                    self._make_valid_lambda_node("n2", "func-b"),
                ],
                "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
                "deployment_settings": {"region": "", "execution_role_arn": ""},
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 200)
        resources = response.data["resources"]
        self.assertEqual(resources[0]["connection_count"], 1)
        self.assertEqual(resources[1]["connection_count"], 1)

    def test_plan_get_not_allowed(self):
        response = self.client.get("/plan")
        self.assertEqual(response.status_code, 405)

    def test_plan_invalid_memory_size(self):
        node = self._make_valid_lambda_node()
        node["data"]["config"]["memory_size"] = 64  # Below minimum 128
        payload = {
            "diagram": {
                "nodes": [node],
                "edges": [],
                "deployment_settings": {"region": "", "execution_role_arn": ""},
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertFalse(response.data["valid"])
