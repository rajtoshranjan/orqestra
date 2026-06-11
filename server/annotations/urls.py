from rest_framework.routers import DefaultRouter

from .views import AnnotationViewSet, CommentViewSet, NotificationViewSet

router = DefaultRouter()
router.register(r"comments", CommentViewSet, basename="annotation-comment")
router.register(r"notifications", NotificationViewSet, basename="notification")
# Registered last at the bare prefix; the uuid lookup_value_regex on the
# viewset keeps detail routes from swallowing the prefixes above.
router.register(r"", AnnotationViewSet, basename="annotation")

urlpatterns = router.urls
