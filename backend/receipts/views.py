import json
import csv

from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.core.paginator import Paginator
from django.db import IntegrityError, transaction
from django.http import HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.vary import vary_on_cookie

from .forms import ReceiptCreateForm
from .models import Notification, Receipt
from .signals import notification_data


def unauthorized() -> JsonResponse:
    return JsonResponse({"detail": "Требуется авторизация."}, status=401)


def receipt_data(receipt: Receipt) -> dict:
    return {
        "id": receipt.id,
        "purchased_at": receipt.purchased_at.isoformat(),
        "amount": str(receipt.amount),
        "status": receipt.status,
        "status_label": receipt.get_status_display(),
        "rejection_reason": receipt.rejection_reason,
        "registered_at": receipt.registered_at.isoformat(),
    }


@method_decorator(vary_on_cookie, name="dispatch")
class ReceiptsView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return unauthorized()
        page = Paginator(
            Receipt.objects.filter(owner=request.user).only(
                "id", "purchased_at", "amount", "status", "rejection_reason", "registered_at"
            ),
            10,
        ).get_page(request.GET.get("page", 1))
        return JsonResponse(
            {
                "results": [receipt_data(receipt) for receipt in page.object_list],
                "pagination": {
                    "page": page.number,
                    "pages": page.paginator.num_pages,
                    "count": page.paginator.count,
                    "has_next": page.has_next(),
                    "has_previous": page.has_previous(),
                },
            }
        )

    def post(self, request):
        if not request.user.is_authenticated:
            return unauthorized()
        if request.content_type and request.content_type.startswith("application/json"):
            try:
                payload = json.loads(request.body)
            except (TypeError, json.JSONDecodeError):
                return JsonResponse({"errors": {"__all__": ["Передайте корректный JSON."]}}, status=400)
            files = None
        else:
            payload = request.POST
            files = request.FILES

        form = ReceiptCreateForm(payload, files)
        if not form.is_valid():
            return JsonResponse({"errors": form.errors.get_json_data()}, status=400)
        try:
            with transaction.atomic():
                receipt = form.save(owner=request.user)
        except IntegrityError:
            return JsonResponse(
                {"errors": {"__all__": [{"message": "Этот чек уже был зарегистрирован."}]}}, status=400
            )
        return JsonResponse({"receipt": receipt_data(receipt)}, status=201)


receipts = ReceiptsView.as_view()


@require_GET
def export_approved_receipts(request):
    if not request.user.is_authenticated:
        return unauthorized()

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = 'attachment; filename="approved-receipts.csv"'
    response.write("\ufeff")
    writer = csv.writer(response)
    writer.writerow(
        [
            "ID",
            "ФН",
            "ФД",
            "ФП",
            "Дата и время покупки",
            "Сумма",
            "Дата регистрации",
            "Статус",
        ]
    )
    for receipt in Receipt.objects.filter(
        owner=request.user, status=Receipt.Status.APPROVED
    ).order_by("-registered_at"):
        writer.writerow(
            [
                receipt.pk,
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


@require_GET
def notifications(request):
    if not request.user.is_authenticated:
        return unauthorized()
    notification_list = list(
        Notification.objects.filter(owner=request.user).select_related("receipt")[:20]
    )
    return JsonResponse(
        {
            "results": [notification_data(notification) for notification in notification_list],
            "unread_count": Notification.objects.filter(owner=request.user, read_at__isnull=True).count(),
        }
    )


@require_POST
def notifications_read(request):
    if not request.user.is_authenticated:
        return unauthorized()
    Notification.objects.filter(owner=request.user, read_at__isnull=True).update(read_at=timezone.now())
    return JsonResponse({"unread_count": 0})


@require_GET
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


@require_GET
def health(request):
    return JsonResponse({"status": "ok"})


@require_GET
def auth_me(request):
    if not request.user.is_authenticated:
        return unauthorized()
    return JsonResponse({"username": request.user.get_username()})


@require_POST
def auth_logout(request):
    logout(request)
    return JsonResponse({"ok": True})


def form_errors(form) -> dict[str, list[str]]:
    return {field: [str(error) for error in errors] for field, errors in form.errors.items()}


def auth_payload(request) -> dict:
    try:
        payload = json.loads(request.body)
    except (TypeError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


@require_POST
def auth_login(request):
    form = AuthenticationForm(request, data=auth_payload(request))
    if not form.is_valid():
        return JsonResponse({"errors": form_errors(form)}, status=400)
    login(request, form.get_user())
    return JsonResponse({"ok": True})


@require_POST
def auth_register(request):
    form = UserCreationForm(auth_payload(request))
    if not form.is_valid():
        return JsonResponse({"errors": form_errors(form)}, status=400)
    user = form.save()
    login(request, user)
    return JsonResponse({"ok": True}, status=201)

