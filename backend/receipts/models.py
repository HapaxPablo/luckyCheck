from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
from django.db import models


MAX_RECEIPT_PHOTO_SIZE = 5 * 1024 * 1024


def validate_receipt_photo_size(photo) -> None:
    if photo.size > MAX_RECEIPT_PHOTO_SIZE:
        raise ValidationError("Размер фотографии чека не должен превышать 5 МБ.")


class Receipt(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "На проверке"
        APPROVED = "approved", "Принят"
        REJECTED = "rejected", "Отклонён"

    fn = models.CharField("ФН", max_length=32)
    fd = models.CharField("ФД", max_length=32)
    fp = models.CharField("ФП", max_length=32)
    purchased_at = models.DateTimeField("Дата и время покупки")
    amount = models.DecimalField("Сумма", max_digits=12, decimal_places=2)
    status = models.CharField("Статус", max_length=16, choices=Status.choices, default=Status.PENDING)
    rejection_reason = models.TextField("Причина отказа", blank=True)
    receipt_photo = models.ImageField(
        "Фотография чека",
        upload_to="receipts/%Y/%m/%d/",
        blank=True,
        validators=[
            FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png", "webp"]),
            validate_receipt_photo_size,
        ],
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="receipts",
        verbose_name="Пользователь",
    )
    registered_at = models.DateTimeField("Дата регистрации", auto_now_add=True)

    class Meta:
        ordering = ("-registered_at",)
        constraints = [
            models.UniqueConstraint(fields=("fn", "fd", "fp"), name="unique_receipt_fiscal_data"),
        ]
        indexes = [models.Index(fields=("owner", "-registered_at"))]
        verbose_name = "чек"
        verbose_name_plural = "чеки"

    def clean(self) -> None:
        super().clean()
        if self.status == self.Status.REJECTED and not self.rejection_reason.strip():
            raise ValidationError({"rejection_reason": "Укажите причину отказа."})

    def save(self, *args, **kwargs):
        if self.status != self.Status.REJECTED:
            self.rejection_reason = ""
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Чек ФН {self.fn}, ФД {self.fd}"


class Notification(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="receipt_notifications",
        verbose_name="Пользователь",
    )
    receipt = models.ForeignKey(
        Receipt,
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="Чек",
    )
    status = models.CharField("Новый статус", max_length=16, choices=Receipt.Status.choices)
    message = models.CharField("Текст", max_length=255)
    created_at = models.DateTimeField("Дата создания", auto_now_add=True)
    read_at = models.DateTimeField("Дата прочтения", null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("owner", "read_at", "-created_at"))]
        verbose_name = "уведомление"
        verbose_name_plural = "уведомления"

    def __str__(self) -> str:
        return self.message

