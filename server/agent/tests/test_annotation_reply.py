from annotations.models import Annotation, Comment
from django.test import override_settings
from django.urls import reverse
from organisations.models import Organisation
from orqestra.tests import BaseTestCase
from projects.models import Project
from rest_framework import status

from accounts.models import User
from agent.constants import AGENT_ID


@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class AgentAnnotationReplyTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.project = Project.objects.create(
            organisation=self.organisation, name="P", nodes=[], edges=[]
        )
        self.annotation = Annotation.objects.create(
            project=self.project,
            author=self.user,
            target_type="node",
            target_id="node-1",
        )

    def test_reply_creates_agent_authored_comment(self):
        response = self.client.post(
            reverse("agent-annotation-reply", args=[self.annotation.id]),
            {"body": "Added a cache in front of the database."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        comment = Comment.objects.get()
        self.assertEqual(comment.author_type, "agent")
        self.assertEqual(comment.origin, AGENT_ID)
        self.assertIsNone(comment.author)
        self.assertEqual(comment.body, "Added a cache in front of the database.")
        self.assertEqual(self.annotation.events.filter(event_type="comment_added").count(), 1)

    def test_reply_requires_a_body(self):
        response = self.client.post(
            reverse("agent-annotation-reply", args=[self.annotation.id]),
            {"body": "   "},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reply_on_other_org_annotation_is_not_found(self):
        other_user = User.objects.create_user(
            email="o@example.com", password="TestPassword123!", name="O"
        )
        other_org = Organisation.objects.create(name="Other", owner=other_user)
        other_project = Project.objects.create(organisation=other_org, name="X")
        other_annotation = Annotation.objects.create(
            project=other_project, author=other_user, target_type="node", target_id="n"
        )

        response = self.client.post(
            reverse("agent-annotation-reply", args=[other_annotation.id]),
            {"body": "hi"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
