from django.urls import path

from .views import DeployView, HealthCheckView, PlanView

urlpatterns = [
    path("health", HealthCheckView.as_view(), name="health"),
    path("api/plan", PlanView.as_view(), name="plan"),
    path("api/deploy", DeployView.as_view(), name="deploy"),
]
