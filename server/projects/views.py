from rest_framework import viewsets

from organisations.helpers import get_active_organisation
from organisations.permissions import IsOrganisationMember

from .models import Project
from .serializers import ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            self.permission_classes = [IsOrganisationMember]
        else:
            from organisations.permissions import CanWriteOrganisation

            self.permission_classes = [CanWriteOrganisation]
        return super().get_permissions()

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        return Project.objects.filter(organisation=active_org)

    def perform_create(self, serializer):
        active_org = get_active_organisation(self.request)
        project = serializer.save(organisation=active_org)
        from organisations.helpers import log_action

        log_action(
            organisation=active_org,
            actor=self.request.user,
            action="project.create",
            details={"project_id": str(project.id), "project_name": project.name},
        )

    def perform_update(self, serializer):
        project = serializer.save()
        from organisations.helpers import log_action

        log_action(
            organisation=project.organisation,
            actor=self.request.user,
            action="project.update",
            details={"project_id": str(project.id), "project_name": project.name},
        )

    def perform_destroy(self, instance):
        organisation = instance.organisation
        project_id = str(instance.id)
        project_name = instance.name
        instance.delete()
        from organisations.helpers import log_action

        log_action(
            organisation=organisation,
            actor=self.request.user,
            action="project.delete",
            details={"project_id": project_id, "project_name": project_name},
        )
