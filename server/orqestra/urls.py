from django.urls import include, path

urlpatterns = [
    path("accounts/", include("accounts.urls")),
    path("organisations/", include("organisations.urls")),
    path("deployments/", include("deployments.urls")),
    path("projects/", include("projects.urls")),
    path("", include("cloud_services.urls")),
]
