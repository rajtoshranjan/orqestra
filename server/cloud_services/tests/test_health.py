from orqestra.tests import BaseTestCase


class HealthCheckTests(BaseTestCase):
    def test_health_check_returns_ok(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["ok"])

    def test_health_check_post_not_allowed(self):
        response = self.client.post("/health")
        self.assertEqual(response.status_code, 405)
