from agent.llm.types import ToolSpec
from agent.tools import GRAPH_OP_NAMES, graph_tool_specs
from django.test import SimpleTestCase


class ToolSpecTests(SimpleTestCase):
    def test_returns_toolspecs_with_unique_names(self):
        specs = graph_tool_specs()

        self.assertTrue(all(isinstance(spec, ToolSpec) for spec in specs))
        names = [spec.name for spec in specs]
        self.assertEqual(len(names), len(set(names)))

    def test_covers_the_expected_operations(self):
        names = {spec.name for spec in graph_tool_specs()}

        self.assertEqual(names, set(GRAPH_OP_NAMES))

    def test_each_schema_is_a_json_object(self):
        for spec in graph_tool_specs():
            self.assertEqual(spec.input_schema.get("type"), "object")
