from rest_framework.routers import DefaultRouter

from .views import AgentAnnotationViewSet, AgentConversationViewSet, AgentRunViewSet

router = DefaultRouter()
router.register(
    r"conversations", AgentConversationViewSet, basename="agent-conversation"
)
router.register(r"runs", AgentRunViewSet, basename="agent-run")
router.register(r"annotations", AgentAnnotationViewSet, basename="agent-annotation")

urlpatterns = router.urls
