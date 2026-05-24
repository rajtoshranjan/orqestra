from django.urls import include, path

urlpatterns = [
    path("", include("cloud_services.urls")),
    path("api/projects/", include("projects.urls")),
]
