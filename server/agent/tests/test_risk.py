from agent.constants import RiskLevel
from agent.risk import classify_op_risk
from django.test import SimpleTestCase


class RiskTests(SimpleTestCase):
    def test_remove_requires_confirmation(self):
        self.assertEqual(
            classify_op_risk("remove", {"target_id": "n1"}), RiskLevel.CONFIRM
        )

    def test_add_resource_is_safe(self):
        self.assertEqual(
            classify_op_risk("add_resource", {"service_id": "lambda"}), RiskLevel.SAFE
        )

    def test_read_only_ops_are_safe(self):
        self.assertEqual(classify_op_risk("query_graph", {}), RiskLevel.SAFE)
