from django.db import models

from .constants import AnnotationStatus


class AnnotationQuerySet(models.QuerySet):
    def for_organisation(self, organisation):
        return self.filter(project__organisation=organisation)

    def for_project(self, project_id):
        return self.filter(project_id=project_id)

    def with_related(self):
        return self.select_related("author", "resolved_by").prefetch_related(
            "comments__author",
            "comments__reactions__user",
            "comments__mentions",
        )

    def apply_filters(self, params, user):
        queryset = self

        if params.get("include_archived") != "true":
            queryset = queryset.filter(archived=False)

        status = params.get("status")
        if status in [choice.value for choice in AnnotationStatus]:
            queryset = queryset.filter(status=status)

        target_type = params.get("target_type")
        if target_type:
            queryset = queryset.filter(target_type=target_type)

        author = params.get("author")
        if author == "me":
            queryset = queryset.filter(author=user)
        elif author:
            queryset = queryset.filter(author_id=author)

        if params.get("mentions") == "me":
            queryset = queryset.filter(comments__mentions__user=user).distinct()

        return queryset


class NotificationQuerySet(models.QuerySet):
    def for_recipient(self, user, organisation):
        return self.filter(recipient=user, organisation=organisation)

    def unread(self):
        return self.filter(read_at__isnull=True)
