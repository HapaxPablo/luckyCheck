import json
import os
from datetime import datetime
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from receipts.forms import ReceiptCreateForm
from receipts.models import Notification, Receipt


PROMO_ENV = {"PROMO_START_DATE": "2026-01-01", "PROMO_END_DATE": "2026-12-31"}


class ReceiptFormTests(TestCase):
    def data(self, **changes):
        data = {"fn": "9282440300695123", "fd": "123", "fp": "12345678", "purchased_at": "2026-06-15T12:00", "amount": "1000.00"}
        data.update(changes)
        return data

    @patch.dict(os.environ, PROMO_ENV, clear=False)
    def test_accepts_purchase_inside_promo_period(self):
        self.assertTrue(ReceiptCreateForm(self.data()).is_valid())

    @patch.dict(os.environ, PROMO_ENV, clear=False)
    def test_rejects_purchase_outside_promo_period(self):
        form = ReceiptCreateForm(self.data(purchased_at="2027-01-01T12:00"))
        self.assertFalse(form.is_valid())
        self.assertIn("purchased_at", form.errors)

    @patch.dict(os.environ, PROMO_ENV, clear=False)
    def test_rejects_amount_below_minimum(self):
        form = ReceiptCreateForm(self.data(amount="999.99"))
        self.assertFalse(form.is_valid())
        self.assertIn("amount", form.errors)

    @patch.dict(os.environ, PROMO_ENV, clear=False)
    def test_rejects_non_numeric_fiscal_data(self):
        form = ReceiptCreateForm(self.data(fn="00A"))
        self.assertFalse(form.is_valid())
        self.assertIn("fn", form.errors)

    @patch.dict(os.environ, PROMO_ENV, clear=False)
    def test_rejects_invalid_fiscal_field_lengths(self):
        for field, value in (("fn", "123"), ("fd", "12345678901"), ("fp", "123456789")):
            with self.subTest(field=field):
                form = ReceiptCreateForm(self.data(**{field: value}))
                self.assertFalse(form.is_valid())
                self.assertIn(field, form.errors)


@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class ReceiptApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="user", password="password")
        self.other_user = get_user_model().objects.create_user(username="other", password="password")
        self.url = reverse("receipts:receipts")

    def payload(self, **changes):
        data = {"fn": "9282440300695123", "fd": "123", "fp": "12345678", "purchased_at": "2026-06-15T12:00", "amount": "1500.00"}
        data.update(changes)
        return data

    def test_returns_current_authenticated_user(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("auth_me"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"username": self.user.username})

    def test_does_not_return_current_user_to_anonymous_visitor(self):
        response = self.client.get(reverse("auth_me"))

        self.assertEqual(response.status_code, 401)

    def test_logs_out_current_user(self):
        self.client.force_login(self.user)

        response = self.client.post(reverse("auth_logout"))

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_status_change_creates_notification_for_receipt_owner(self):
        receipt = Receipt.objects.create(owner=self.user, fn="9282440300695123", fd="123", fp="12345678", purchased_at=timezone.now(), amount=Decimal("1500.00"))

        receipt.status = Receipt.Status.APPROVED
        receipt.save()

        notification = Notification.objects.get()
        self.assertEqual(notification.owner, self.user)
        self.assertEqual(notification.receipt, receipt)
        self.assertEqual(notification.status, Receipt.Status.APPROVED)

    def test_notification_endpoints_return_and_mark_current_users_notifications(self):
        receipt = Receipt.objects.create(owner=self.user, fn="9282440300695123", fd="123", fp="12345678", purchased_at=timezone.now(), amount=Decimal("1500.00"))
        Notification.objects.create(owner=self.user, receipt=receipt, status=Receipt.Status.PENDING, message="Чек отправлен на проверку.")
        self.client.force_login(self.user)

        response = self.client.get(reverse("receipts:notifications"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["unread_count"], 1)

        response = self.client.post(reverse("receipts:notifications_read"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["unread_count"], 0)
        self.assertIsNotNone(Notification.objects.get().read_at)

    @patch.dict(os.environ, PROMO_ENV, clear=False)
    def test_creates_pending_receipt_for_current_user(self):
        self.client.force_login(self.user)
        response = self.client.post(self.url, data=json.dumps({**self.payload(), "status": "approved"}), content_type="application/json")
        self.assertEqual(response.status_code, 201)
        receipt = Receipt.objects.get()
        self.assertEqual(receipt.owner, self.user)
        self.assertEqual(receipt.status, Receipt.Status.PENDING)

    @patch.dict(os.environ, PROMO_ENV, clear=False)
    def test_duplicate_returns_a_clear_validation_error(self):
        Receipt.objects.create(
            owner=self.user,
            fn="9282440300695123",
            fd="123",
            fp="12345678",
            purchased_at=timezone.make_aware(datetime(2026, 6, 15, 12)),
            amount=Decimal("1500.00"),
        )
        self.client.force_login(self.user)
        response = self.client.post(self.url, data=json.dumps(self.payload()), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Этот чек уже был зарегистрирован.", str(response.json()))

    @patch.dict(os.environ, PROMO_ENV, clear=False)
    def test_duplicate_is_rejected_when_purchase_date_differs(self):
        Receipt.objects.create(owner=self.user, fn="9282440300695123", fd="123", fp="12345678", purchased_at=timezone.make_aware(datetime(2026, 6, 1, 12)), amount=Decimal("1500.00"))
        self.client.force_login(self.user)

        response = self.client.post(self.url, data=json.dumps(self.payload(purchased_at="2026-06-20T12:00")), content_type="application/json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Этот чек уже был зарегистрирован.", str(response.json()))

    def test_api_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    def test_list_is_scoped_to_current_user_and_paginated(self):
        for number in range(11):
            Receipt.objects.create(
                owner=self.user,
                fn=f"fn-{number}", fd=f"fd-{number}", fp=f"fp-{number}",
                purchased_at=timezone.make_aware(datetime(2026, 6, 15, 12)), amount=Decimal("1000.00"),
            )
        Receipt.objects.create(owner=self.other_user, fn="other", fd="other", fp="other", purchased_at=timezone.now(), amount=Decimal("1000.00"))
        self.client.force_login(self.user)
        response = self.client.get(f"{self.url}?page=1&owner={self.other_user.pk}")
        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(body["results"]), 10)
        self.assertEqual(body["pagination"]["count"], 11)
        self.assertEqual(self.client.get(f"{self.url}?page=2").json()["pagination"]["page"], 2)


class ReceiptModelTests(TestCase):
    def test_rejection_requires_a_reason(self):
        user = get_user_model().objects.create_user(username="moderator")
        receipt = Receipt(owner=user, fn="1", fd="2", fp="3", purchased_at=timezone.now(), amount=Decimal("1000.00"), status=Receipt.Status.REJECTED)
        with self.assertRaises(ValidationError):
            receipt.full_clean()
