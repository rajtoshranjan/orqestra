from django.urls import path

from .views import DeployView, HealthCheckView, PlanView

urlpatterns = [
    path("health", HealthCheckView.as_view(), name="health"),
    path("plan", PlanView.as_view(), name="plan"),
    path("deploy", DeployView.as_view(), name="deploy"),
]
