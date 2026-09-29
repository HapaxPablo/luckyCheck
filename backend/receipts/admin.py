import csv

from django.contrib import admin
from django.http import HttpResponse
from django.urls import path

from .models import Notification, Receipt


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "owner",
        "fn",
        "fd",
        "fp",
        "amount",
        "status",
        "has_receipt_photo",
        "purchased_at",
        "registered_at",
    )
    list_filter = ("status", "registered_at")
    search_fields = ("fn", "fd", "fp", "owner__username")
    list_select_related = ("owner",)
    readonly_fields = ("registered_at",)
    ordering = ("-registered_at",)
    actions = ("export_selected_approved_receipts",)
    change_list_template = "admin/receipts/receipt/change_list.html"

    def get_urls(self):
        return [
            path(
                "export-approved-csv/",
                self.admin_site.admin_view(self.export_all_approved_receipts),
                name="receipts_receipt_export_all_approved",
            ),
            *super().get_urls(),
        ]

    @admin.display(boolean=True, description="Есть фото")
    def has_receipt_photo(self, receipt: Receipt) -> bool:
        return bool(receipt.receipt_photo)

    def export_receipts_csv(self, receipts) -> HttpResponse:
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="approved-receipts.csv"'
        response.write("\ufeff")
        writer = csv.writer(response)
        writer.writerow(
            [
                "ID",
                "Пользователь",
                "ФН",
                "ФД",
                "ФП",
                "Дата и время покупки",
                "Сумма",
                "Дата регистрации",
                "Статус",
            ]
        )
        for receipt in receipts.select_related("owner"):
            writer.writerow(
                [
                    receipt.pk,
                    receipt.owner.get_username(),
                    receipt.fn,
                    receipt.fd,
                    receipt.fp,
                    receipt.purchased_at.strftime("%d.%m.%Y %H:%M"),
                    f"{receipt.amount:.2f}",
                    receipt.registered_at.strftime("%d.%m.%Y %H:%M"),
                    receipt.get_status_display(),
                ]
            )
        return response

    @admin.action(description="Скачать отмеченные принятые чеки в CSV")
    def export_selected_approved_receipts(self, request, queryset):
        approved_receipts = queryset.filter(status=Receipt.Status.APPROVED)
        if not approved_receipts.exists():
            self.message_user(request, "Среди отмеченных чеков нет принятых.", level="warning")
            return None
        return self.export_receipts_csv(approved_receipts)

    def export_all_approved_receipts(self, request):
        return self.export_receipts_csv(
            Receipt.objects.filter(status=Receipt.Status.APPROVED).order_by("-registered_at")
        )


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "receipt", "status", "created_at", "read_at")
    list_filter = ("status", "read_at")
    search_fields = ("owner__username", "message")
    readonly_fields = ("owner", "receipt", "status", "message", "created_at", "read_at")

