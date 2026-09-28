from django.urls import path

from . import views

app_name = "receipts"

urlpatterns = [
    path("receipts/", views.receipts, name="receipts"),
    path("csrf/", views.csrf, name="csrf"),
    path("health/", views.health, name="health"),
]

