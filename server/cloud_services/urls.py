from django.urls import path

from .views import CloudServicesViewSet

urlpatterns = [
    path(
        "health",
        CloudServicesViewSet.as_view({"get": "health"}),
        name="health",
    ),
    path(
        "plan",
        CloudServicesViewSet.as_view({"post": "plan"}),
        name="plan",
    ),
]
