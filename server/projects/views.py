from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from .models import Project
from .serializers import ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling CRUD operations on cloud projects.
    """

    serializer_class = ProjectSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = Project.objects.all()
        # Support request query parameters for backend API calls
        project_id = self.request.query_params.get("project_id")
        if project_id:
            queryset = queryset.filter(id=project_id)
        return queryset
