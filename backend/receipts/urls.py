from django.urls import path

from . import views

app_name = "receipts"

urlpatterns = [
    path("receipts/", views.receipts, name="receipts"),
    path("receipts/export/", views.export_approved_receipts, name="export_approved_receipts"),
    path("notifications/", views.notifications, name="notifications"),
    path("notifications/read/", views.notifications_read, name="notifications_read"),
    path("csrf/", views.csrf, name="csrf"),
    path("health/", views.health, name="health"),
]

