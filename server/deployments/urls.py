from django.urls import path

from .views import DeploymentViewSet

urlpatterns = [
    path(
        "",
        DeploymentViewSet.as_view({"post": "create"}),
        name="deployment-create",
    ),
    path(
        "<uuid:pk>/",
        DeploymentViewSet.as_view({"get": "retrieve"}),
        name="deployment-detail",
    ),
    path(
        "<uuid:pk>/callback/",
        DeploymentViewSet.as_view({"post": "callback"}),
        name="deployment-callback",
    ),
    path(
        "project/<uuid:project_id>/state/",
        DeploymentViewSet.as_view({"get": "project_state"}),
        name="project-deployment-state",
    ),
]
