from django.urls import path

from .consumers import ReceiptConsumer

websocket_urlpatterns = [path("ws/receipts/", ReceiptConsumer.as_asgi())]
