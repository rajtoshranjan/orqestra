from agent.prompts import build_system_prompt
from django.test import TestCase

CATALOG = [
    {"id": "lambda", "name": "AWS Lambda", "category": "compute"},
    {"id": "s3", "name": "Amazon S3", "category": "storage"},
]

NODES = [
    {
        "id": "n1",
        "data": {
            "service_id": "lambda",
            "label": "API",
            "config": {"memory_mb": 512},
        },
    },
    {
        "id": "n2",
        "data": {"service_id": "s3", "label": "Assets"},
    },
]

EDGES = [
    {
        "id": "e1",
        "source": "n1",
        "target": "n2",
        "data": {"relationship_kind": "writes-to"},
    }
]


class PromptTests(TestCase):
    def test_prompt_lists_catalog_services(self):
        prompt = build_system_prompt(CATALOG, NODES, EDGES)

        self.assertIn("AWS Lambda", prompt)
        self.assertIn("s3", prompt)

    def test_prompt_summarizes_current_graph_nodes(self):
        prompt = build_system_prompt(CATALOG, NODES, EDGES)

        self.assertIn("n1", prompt)
        self.assertIn("2 node", prompt)
        # node service + label must be identifiable so the agent can edit in place.
        self.assertIn("lambda", prompt)
        self.assertIn("API", prompt)

    def test_prompt_includes_node_config_and_edges(self):
        prompt = build_system_prompt(CATALOG, NODES, EDGES)

        # config is needed so the agent knows what to change.
        self.assertIn("memory_mb", prompt)
        # edges (with relationship) must be surfaced, not just nodes.
        self.assertIn("writes-to", prompt)
        self.assertIn("1 edge", prompt)

    def test_prompt_instructs_edit_in_place(self):
        prompt = build_system_prompt(CATALOG, NODES, EDGES)

        # The agent must modify existing resources rather than recreating them.
        self.assertIn("query_graph", prompt)
        self.assertIn("in place", prompt.lower())

    def test_prompt_marks_empty_canvas(self):
        prompt = build_system_prompt(CATALOG, [], [])

        self.assertIn("empty", prompt.lower())

    def test_prompt_mentions_target_user_and_rules(self):
        prompt = build_system_prompt(CATALOG, NODES, EDGES)

        self.assertIn("DevOps", prompt)
        self.assertIn("validate", prompt)
