from unittest.mock import patch

from django.test import SimpleTestCase
from realtime.events import send_agent_event


class SendAgentEventTests(SimpleTestCase):
    @patch("realtime.events.emit_event")
    def test_targets_project_group_without_extra_prefix(self, mock_emit):
        send_agent_event("proj-1", "agent.tool_call", {"x": 1})

        mock_emit.assert_called_once_with("project_proj-1", "agent.tool_call", {"x": 1})
