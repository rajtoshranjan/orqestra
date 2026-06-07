from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt import views as jwt_views

from .serializers import CustomTokenObtainPairSerializer
from .views import UserViewSet


class CustomTokenObtainPairView(jwt_views.TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


router = DefaultRouter()
router.register(r"", UserViewSet, basename="user")

urlpatterns = [
    path(
        "login/",
        CustomTokenObtainPairView.as_view(),
        name="token-obtain-pair",
    ),
    path(
        "token/refresh/",
        jwt_views.TokenRefreshView.as_view(),
        name="token-refresh",
    ),
]

urlpatterns += router.urls
