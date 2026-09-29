from django.contrib import admin
from django.urls import include, path

from receipts.views import auth_login, auth_logout, auth_me, auth_register

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", auth_login, name="auth_login"),
    path("api/auth/logout/", auth_logout, name="auth_logout"),
    path("api/auth/me/", auth_me, name="auth_me"),
    path("api/auth/register/", auth_register, name="auth_register"),
    path("api/", include("receipts.urls")),
]

