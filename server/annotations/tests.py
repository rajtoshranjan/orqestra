from accounts.models import User
from organisations.constants import OrganisationMemberRole
from organisations.models import AuditLog, Organisation, OrganisationMember
from orqestra.tests import BaseTestCase
from projects.models import Project

from .constants import AnnotationEventType, AnnotationStatus, NotificationVerb
from .models import (
    Annotation,
    AnnotationEvent,
    Comment,
    Mention,
    Notification,
    Reaction,
)


class AnnotationBaseTestCase(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.project = self._create_project()

    def _create_project(self, organisation=None, name="Test Project"):
        return Project.objects.create(
            organisation=organisation or self.organisation, name=name
        )

    def _add_member(self, role=OrganisationMemberRole.REGULAR.value, email=None):
        member_user = User.objects.create_user(
            email=email or f"{role}-member@example.com",
            password="TestPassword123!",
            name=f"{role.title()} Member",
        )
        OrganisationMember.objects.create(
            organisation=self.organisation, user=member_user, role=role
        )
        return member_user

    def _login_as(self, user):
        self.client.force_authenticate(user=user)
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(self.organisation.id))

    def _create_annotation(self, author=None, body="Initial comment", **overrides):
        annotation = Annotation.objects.create(
            project=overrides.pop("project", self.project),
            author=author or self.user,
            target_type=overrides.pop("target_type", "canvas"),
            target_id=overrides.pop("target_id", ""),
            position=overrides.pop("position", {"x": 100, "y": 200}),
            **overrides,
        )
        Comment.objects.create(
            annotation=annotation, author=annotation.author, body=body
        )
        return annotation

    def _other_org_with_project(self):
        other_owner = User.objects.create_user(
            email="other-owner@example.com",
            password="TestPassword123!",
            name="Other Owner",
        )
        other_org = Organisation.objects.create(name="Other Org", owner=other_owner)
        other_project = Project.objects.create(
            organisation=other_org, name="Other Project"
        )
        return other_owner, other_org, other_project

    def _mention_token(self, user):
        return f"@[{user.name}](user:{user.id})"


class AnnotationCreateTests(AnnotationBaseTestCase):
    def test_create_canvas_annotation_success(self):
        response = self.client.post(
            "/annotations/",
            {
                "project": str(self.project.id),
                "target_type": "canvas",
                "position": {"x": 10, "y": 20},
                "body": "This VPC should be private.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertTrue(payload["meta"]["success"])
        data = payload["data"]
        self.assertEqual(data["target_type"], "canvas")
        self.assertEqual(data["status"], AnnotationStatus.OPEN.value)
        self.assertEqual(len(data["comments"]), 1)
        self.assertEqual(data["comments"][0]["body"], "This VPC should be private.")

        annotation = Annotation.objects.get(id=data["id"])
        self.assertEqual(annotation.comments.count(), 1)
        self.assertTrue(
            annotation.events.filter(
                event_type=AnnotationEventType.CREATED.value
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                organisation=self.organisation, action="annotation.create"
            ).exists()
        )

    def test_create_node_annotation_requires_target_id(self):
        response = self.client.post(
            "/annotations/",
            {
                "project": str(self.project.id),
                "target_type": "node",
                "body": "Looks wrong.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_create_canvas_annotation_requires_position(self):
        response = self.client.post(
            "/annotations/",
            {
                "project": str(self.project.id),
                "target_type": "canvas",
                "body": "Floating comment.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class AnnotationListTests(AnnotationBaseTestCase):
    def test_list_requires_project_param(self):
        response = self.client.get("/annotations/")
        self.assertEqual(response.status_code, 400)

    def test_list_scoped_to_project(self):
        annotation = self._create_annotation()
        other_project = self._create_project(name="Second Project")
        self._create_annotation(project=other_project)

        response = self.client.get(f"/annotations/?project={self.project.id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], str(annotation.id))

    def test_filters(self):
        member = self._add_member()
        open_annotation = self._create_annotation()
        node_annotation = self._create_annotation(
            target_type="node", target_id="node-1", position={"dx": 5, "dy": 5}
        )
        resolved_annotation = self._create_annotation(author=member)
        resolved_annotation.status = AnnotationStatus.RESOLVED.value
        resolved_annotation.save()
        mention_annotation = self._create_annotation(
            body=f"Ping {self._mention_token(member)}"
        )
        Mention.objects.create(comment=mention_annotation.comments.first(), user=member)

        response = self.client.get(
            f"/annotations/?project={self.project.id}&status=resolved"
        )
        self.assertEqual(
            [item["id"] for item in response.json()["data"]],
            [str(resolved_annotation.id)],
        )

        response = self.client.get(
            f"/annotations/?project={self.project.id}&target_type=node"
        )
        self.assertEqual(
            [item["id"] for item in response.json()["data"]],
            [str(node_annotation.id)],
        )

        response = self.client.get(
            f"/annotations/?project={self.project.id}&author={member.id}"
        )
        self.assertEqual(
            [item["id"] for item in response.json()["data"]],
            [str(resolved_annotation.id)],
        )

        self._login_as(member)
        response = self.client.get(
            f"/annotations/?project={self.project.id}&mentions=me"
        )
        self.assertEqual(
            [item["id"] for item in response.json()["data"]],
            [str(mention_annotation.id)],
        )
        self.assertIn(
            str(open_annotation.id),
            [
                item["id"]
                for item in self.client.get(
                    f"/annotations/?project={self.project.id}"
                ).json()["data"]
            ],
        )


class AnnotationCrossOrgTests(AnnotationBaseTestCase):
    def test_cross_org_isolation(self):
        _, other_org, other_project = self._other_org_with_project()
        other_annotation = Annotation.objects.create(
            project=other_project,
            target_type="canvas",
            position={"x": 1, "y": 1},
        )

        response = self.client.get(f"/annotations/?project={other_project.id}")
        self.assertEqual(response.json()["data"], [])

        response = self.client.get(f"/annotations/{other_annotation.id}/")
        self.assertEqual(response.status_code, 404)

        response = self.client.post(
            "/annotations/comments/",
            {"annotation": str(other_annotation.id), "body": "Sneaky reply"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(other_annotation.comments.count(), 0)

        response = self.client.post(
            "/annotations/",
            {
                "project": str(other_project.id),
                "target_type": "canvas",
                "position": {"x": 1, "y": 1},
                "body": "Cross-org comment",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class AnnotationPermissionTests(AnnotationBaseTestCase):
    def test_guest_can_comment_and_react(self):
        guest = self._add_member(role=OrganisationMemberRole.GUEST.value)
        annotation = self._create_annotation()
        self._login_as(guest)

        response = self.client.post(
            "/annotations/comments/",
            {"annotation": str(annotation.id), "body": "Guest reply"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        comment = annotation.comments.first()
        response = self.client.post(
            f"/annotations/comments/{comment.id}/react/",
            {"emoji": "👍"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            Reaction.objects.filter(comment=comment, user=guest, emoji="👍").exists()
        )

    def test_guest_cannot_resolve_others(self):
        guest = self._add_member(role=OrganisationMemberRole.GUEST.value)
        annotation = self._create_annotation()
        self._login_as(guest)

        response = self.client.post(f"/annotations/{annotation.id}/resolve/")
        self.assertEqual(response.status_code, 403)

    def test_guest_can_resolve_own(self):
        guest = self._add_member(role=OrganisationMemberRole.GUEST.value)
        annotation = self._create_annotation(author=guest)
        self._login_as(guest)

        response = self.client.post(f"/annotations/{annotation.id}/resolve/")
        self.assertEqual(response.status_code, 200)

    def test_edit_comment_only_author(self):
        member = self._add_member()
        annotation = self._create_annotation()
        comment = annotation.comments.first()
        self._login_as(member)

        response = self.client.patch(
            f"/annotations/comments/{comment.id}/",
            {"body": "Hijacked"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

        self._login_as(self.user)
        response = self.client.patch(
            f"/annotations/comments/{comment.id}/",
            {"body": "Edited body"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        comment.refresh_from_db()
        self.assertEqual(comment.body, "Edited body")
        self.assertIsNotNone(comment.edited_at)

    def test_admin_can_delete_any_comment(self):
        admin = self._add_member(role=OrganisationMemberRole.ADMIN.value)
        regular = self._add_member(email="regular2@example.com")
        annotation = self._create_annotation()
        comment = Comment.objects.create(
            annotation=annotation, author=regular, body="To be moderated"
        )

        self._login_as(admin)
        response = self.client.delete(f"/annotations/comments/{comment.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Comment.objects.filter(id=comment.id).exists())

    def test_regular_cannot_delete_others_comment(self):
        regular = self._add_member()
        annotation = self._create_annotation()
        comment = annotation.comments.first()

        self._login_as(regular)
        response = self.client.delete(f"/annotations/comments/{comment.id}/")
        self.assertEqual(response.status_code, 403)


class AnnotationWorkflowTests(AnnotationBaseTestCase):
    def test_resolve_sets_fields_creates_event_notification_and_audit_log(self):
        member = self._add_member()
        annotation = self._create_annotation()
        self._login_as(member)

        response = self.client.post(f"/annotations/{annotation.id}/resolve/")
        self.assertEqual(response.status_code, 200)

        annotation.refresh_from_db()
        self.assertEqual(annotation.status, AnnotationStatus.RESOLVED.value)
        self.assertEqual(annotation.resolved_by, member)
        self.assertIsNotNone(annotation.resolved_at)
        self.assertTrue(
            annotation.events.filter(
                event_type=AnnotationEventType.RESOLVED.value
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.user,
                actor=member,
                verb=NotificationVerb.RESOLVED.value,
                annotation=annotation,
            ).exists()
        )
        self.assertTrue(AuditLog.objects.filter(action="annotation.resolve").exists())

    def test_reopen_clears_resolution(self):
        annotation = self._create_annotation()
        self.client.post(f"/annotations/{annotation.id}/resolve/")
        response = self.client.post(f"/annotations/{annotation.id}/reopen/")
        self.assertEqual(response.status_code, 200)

        annotation.refresh_from_db()
        self.assertEqual(annotation.status, AnnotationStatus.OPEN.value)
        self.assertIsNone(annotation.resolved_by)
        self.assertIsNone(annotation.resolved_at)

    def test_archive_excludes_from_default_list(self):
        annotation = self._create_annotation()
        self.client.post(f"/annotations/{annotation.id}/archive/")

        response = self.client.get(f"/annotations/?project={self.project.id}")
        self.assertEqual(response.json()["data"], [])

        response = self.client.get(
            f"/annotations/?project={self.project.id}&include_archived=true"
        )
        self.assertEqual(len(response.json()["data"]), 1)

    def test_events_timeline(self):
        annotation = self._create_annotation()
        AnnotationEvent.objects.create(
            annotation=annotation,
            actor=self.user,
            event_type=AnnotationEventType.CREATED.value,
        )
        self.client.post(f"/annotations/{annotation.id}/resolve/")

        response = self.client.get(f"/annotations/{annotation.id}/events/")
        self.assertEqual(response.status_code, 200)
        event_types = [event["event_type"] for event in response.json()["data"]]
        self.assertIn(AnnotationEventType.RESOLVED.value, event_types)


class CommentTests(AnnotationBaseTestCase):
    def test_reply_notifies_author_and_participants_not_actor(self):
        member = self._add_member()
        other_member = self._add_member(email="participant@example.com")
        annotation = self._create_annotation()
        Comment.objects.create(
            annotation=annotation, author=other_member, body="Earlier reply"
        )

        self._login_as(member)
        response = self.client.post(
            "/annotations/comments/",
            {"annotation": str(annotation.id), "body": "New reply"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        recipients = set(
            Notification.objects.filter(
                verb=NotificationVerb.REPLIED.value, annotation=annotation
            ).values_list("recipient_id", flat=True)
        )
        self.assertEqual(recipients, {self.user.id, other_member.id})

    def test_mention_creates_mention_and_notification(self):
        member = self._add_member()
        annotation = self._create_annotation()

        response = self.client.post(
            "/annotations/comments/",
            {
                "annotation": str(annotation.id),
                "body": f"What do you think {self._mention_token(member)}?",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        comment_id = response.json()["data"]["id"]

        self.assertTrue(
            Mention.objects.filter(comment_id=comment_id, user=member).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=member,
                verb=NotificationVerb.MENTIONED.value,
                comment_id=comment_id,
            ).exists()
        )

    def test_mention_of_non_member_ignored(self):
        outsider = User.objects.create_user(
            email="outsider@example.com",
            password="TestPassword123!",
            name="Outsider",
        )
        annotation = self._create_annotation()

        response = self.client.post(
            "/annotations/comments/",
            {
                "annotation": str(annotation.id),
                "body": f"Hey {self._mention_token(outsider)}",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertFalse(Mention.objects.filter(user=outsider).exists())
        self.assertFalse(Notification.objects.filter(recipient=outsider).exists())

    def test_empty_body_rejected(self):
        annotation = self._create_annotation()
        response = self.client.post(
            "/annotations/comments/",
            {"annotation": str(annotation.id), "body": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_reaction_toggle_and_invalid_emoji(self):
        annotation = self._create_annotation()
        comment = annotation.comments.first()

        response = self.client.post(
            f"/annotations/comments/{comment.id}/react/",
            {"emoji": "🎉"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(comment.reactions.count(), 1)

        response = self.client.post(
            f"/annotations/comments/{comment.id}/react/",
            {"emoji": "🎉"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(comment.reactions.count(), 0)

        response = self.client.post(
            f"/annotations/comments/{comment.id}/react/",
            {"emoji": "💣"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class NotificationTests(AnnotationBaseTestCase):
    def test_unread_count_and_mark_read(self):
        member = self._add_member()
        annotation = self._create_annotation(author=member)
        comment = annotation.comments.first()
        Notification.objects.create(
            recipient=self.user,
            actor=member,
            organisation=self.organisation,
            verb=NotificationVerb.MENTIONED.value,
            annotation=annotation,
            comment=comment,
        )
        Notification.objects.create(
            recipient=self.user,
            actor=member,
            organisation=self.organisation,
            verb=NotificationVerb.REPLIED.value,
            annotation=annotation,
            comment=comment,
        )

        response = self.client.get("/annotations/notifications/unread-count/")
        self.assertEqual(response.json()["data"]["count"], 2)

        response = self.client.get("/annotations/notifications/?unread=true")
        self.assertEqual(len(response.json()["data"]), 2)

        first_id = response.json()["data"][0]["id"]
        response = self.client.post(
            "/annotations/notifications/mark-read/",
            {"ids": [first_id]},
            format="json",
        )
        self.assertEqual(response.json()["data"]["updated"], 1)

        response = self.client.post(
            "/annotations/notifications/mark-read/", {"all": True}, format="json"
        )
        self.assertEqual(response.json()["data"]["updated"], 1)
        response = self.client.get("/annotations/notifications/unread-count/")
        self.assertEqual(response.json()["data"]["count"], 0)

    def test_notifications_scoped_to_active_org(self):
        member = self._add_member()
        annotation = self._create_annotation(author=member)
        _, other_org, _ = self._other_org_with_project()
        OrganisationMember.objects.create(
            organisation=other_org,
            user=self.user,
            role=OrganisationMemberRole.REGULAR.value,
        )
        Notification.objects.create(
            recipient=self.user,
            actor=member,
            organisation=self.organisation,
            verb=NotificationVerb.REPLIED.value,
            annotation=annotation,
        )
        Notification.objects.create(
            recipient=self.user,
            actor=member,
            organisation=other_org,
            verb=NotificationVerb.REPLIED.value,
            annotation=annotation,
        )

        response = self.client.get("/annotations/notifications/")
        self.assertEqual(len(response.json()["data"]), 1)

        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(other_org.id))
        response = self.client.get("/annotations/notifications/")
        self.assertEqual(len(response.json()["data"]), 1)
