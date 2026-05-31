from django.urls import include, path

urlpatterns = [
    path("", include("cloud_services.urls")),
    path("deployments/", include("deployments.urls")),
    path("projects/", include("projects.urls")),
]
