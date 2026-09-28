from django.contrib import admin

from .models import Receipt


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "fn", "fd", "fp", "amount", "status", "purchased_at", "registered_at")
    list_filter = ("status", "registered_at")
    search_fields = ("fn", "fd", "fp", "owner__username")
    list_select_related = ("owner",)
    readonly_fields = ("registered_at",)
    ordering = ("-registered_at",)

