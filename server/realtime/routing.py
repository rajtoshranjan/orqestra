from django.urls import path
from .consumers import OrqestraConsumer

websocket_urlpatterns = [
    path("ws/", OrqestraConsumer.as_asgi()),
]
