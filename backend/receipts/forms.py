from datetime import date
from decimal import Decimal
import os

from django import forms
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import Receipt


def promo_period() -> tuple[date, date]:
    try:
        start = date.fromisoformat(os.environ["PROMO_START_DATE"])
        end = date.fromisoformat(os.environ["PROMO_END_DATE"])
    except (KeyError, ValueError) as exc:
        raise RuntimeError("PROMO_START_DATE и PROMO_END_DATE должны быть датами ISO-8601.") from exc
    if end < start:
        raise RuntimeError("PROMO_END_DATE не может быть раньше PROMO_START_DATE.")
    return start, end


class ReceiptCreateForm(forms.ModelForm):
    class Meta:
        model = Receipt
        fields = ("fn", "fd", "fp", "purchased_at", "amount", "receipt_photo")

    def clean_fn(self) -> str:
        return self._clean_fiscal_field("fn", "ФН")

    def clean_fd(self) -> str:
        return self._clean_fiscal_field("fd", "ФД")

    def clean_fp(self) -> str:
        return self._clean_fiscal_field("fp", "ФП")

    def _clean_fiscal_field(self, field: str, label: str) -> str:
        value = self.cleaned_data[field].strip()
        if not value.isdigit():
            raise ValidationError(f"{label} должен содержать только цифры.")
        allowed_lengths = {"fn": {16}, "fd": set(range(1, 11)), "fp": {8, 10}}
        if len(value) not in allowed_lengths[field]:
            expected = "16" if field == "fn" else "от 1 до 10" if field == "fd" else "8 или 10"
            raise ValidationError(f"{label} должен содержать {expected} цифр.")
        return value

    def clean_amount(self) -> Decimal:
        amount = self.cleaned_data["amount"]
        if amount < Decimal("1000.00"):
            raise ValidationError("Сумма чека должна быть не меньше 1000 ₽.")
        return amount

    def clean_purchased_at(self):
        purchased_at = self.cleaned_data["purchased_at"]
        start, end = promo_period()
        local_date = timezone.localtime(purchased_at).date()
        if not start <= local_date <= end:
            raise ValidationError(
                f"Дата покупки должна быть в периоде акции: {start:%d.%m.%Y}–{end:%d.%m.%Y}."
            )
        return purchased_at

    def clean(self):
        cleaned_data = super().clean()
        fiscal_data = [cleaned_data.get(field) for field in ("fn", "fd", "fp")]
        if all(fiscal_data) and Receipt.objects.filter(fn=fiscal_data[0], fd=fiscal_data[1], fp=fiscal_data[2]).exists():
            raise ValidationError("Этот чек уже был зарегистрирован.")
        return cleaned_data

    def save(self, owner, commit=True):
        receipt = super().save(commit=False)
        receipt.owner = owner
        receipt.status = Receipt.Status.PENDING
        if commit:
            receipt.save()
        return receipt

