from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Notification, Receipt


STATUS_MESSAGES = {
    Receipt.Status.PENDING: "Чек отправлен на проверку.",
    Receipt.Status.APPROVED: "Чек принят.",
    Receipt.Status.REJECTED: "Чек отклонён.",
}


def notification_data(notification: Notification) -> dict:
    return {
        "id": notification.pk,
        "receipt_id": notification.receipt_id,
        "status": notification.status,
        "status_label": notification.get_status_display(),
        "message": notification.message,
        "created_at": notification.created_at.isoformat(),
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
    }


def receipt_data(receipt: Receipt) -> dict:
    return {
        "id": receipt.pk,
        "purchased_at": receipt.purchased_at.isoformat(),
        "amount": str(receipt.amount),
        "status": receipt.status,
        "status_label": receipt.get_status_display(),
        "rejection_reason": receipt.rejection_reason,
        "registered_at": receipt.registered_at.isoformat(),
    }


@receiver(pre_save, sender=Receipt)
def remember_previous_status(sender, instance: Receipt, **kwargs):
    if not instance.pk:
        instance._previous_status = None
        return
    instance._previous_status = sender.objects.filter(pk=instance.pk).values_list("status", flat=True).first()


@receiver(post_save, sender=Receipt)
def notify_receipt_status_change(sender, instance: Receipt, created: bool, **kwargs):
    if not created and instance._previous_status == instance.status:
        return

    notification = Notification.objects.create(
        owner=instance.owner,
        receipt=instance,
        status=instance.status,
        message=STATUS_MESSAGES[instance.status],
    )
    unread_count = Notification.objects.filter(owner=instance.owner, read_at__isnull=True).count()
    payload = {
        "type": "receipt.status_changed",
        "receipt": receipt_data(instance),
        "notification": notification_data(notification),
        "unread_count": unread_count,
    }

    def send_event():
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"receipt_user_{instance.owner_id}",
            {"type": "receipt.status_changed", "payload": payload},
        )

    transaction.on_commit(send_event)
