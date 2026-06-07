from rest_framework import viewsets

from organisations.helpers import get_active_organisation
from organisations.permissions import IsOrganisationMember

from .models import Project
from .serializers import ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsOrganisationMember]

    def get_queryset(self):
        active_org = get_active_organisation(self.request)
        return Project.objects.filter(organisation=active_org)

    def perform_create(self, serializer):
        active_org = get_active_organisation(self.request)
        serializer.save(organisation=active_org)
