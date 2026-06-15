from organisations.helpers import get_active_organisation, log_action
from organisations.permissions import CanWriteOrganisation, IsOrganisationMember
from rest_framework import viewsets

from .models import Project
from .serializers import ProjectListSerializer, ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            self.permission_classes = [IsOrganisationMember]
        else:
            self.permission_classes = [CanWriteOrganisation]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "list":
            return ProjectListSerializer
        return ProjectSerializer

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        return Project.objects.for_organisation(active_org)

    def perform_create(self, serializer):
        active_org = get_active_organisation(self.request)
        project = serializer.save(organisation=active_org)
        log_action(
            organisation=active_org,
            actor=self.request.user,
            action="project.create",
            details={"project_id": str(project.id), "project_name": project.name},
        )

    def perform_update(self, serializer):
        project = serializer.save()
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
        log_action(
            organisation=organisation,
            actor=self.request.user,
            action="project.delete",
            details={"project_id": project_id, "project_name": project_name},
        )
