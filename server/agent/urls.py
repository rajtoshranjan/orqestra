from rest_framework.routers import DefaultRouter

from .views import AgentConversationViewSet, AgentRunViewSet

router = DefaultRouter()
router.register(r"conversations", AgentConversationViewSet, basename="agent-conversation")
router.register(r"runs", AgentRunViewSet, basename="agent-run")

urlpatterns = router.urls
