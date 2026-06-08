from rest_framework.routers import DefaultRouter

from .views import AuditLogViewSet, OrganisationMemberViewSet, OrganisationViewSet

router = DefaultRouter()
router.register(r"members", OrganisationMemberViewSet, basename="organisation-member")
router.register(r"audit-logs", AuditLogViewSet, basename="organisation-audit-log")
router.register(r"", OrganisationViewSet, basename="organisation")

urlpatterns = router.urls
