import json

from django.contrib.auth import login
from django.contrib.auth.forms import UserCreationForm
from django.core.paginator import Paginator
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import redirect, render
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET
from django.views.decorators.vary import vary_on_cookie

from .forms import ReceiptCreateForm
from .models import Receipt


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
        try:
            payload = json.loads(request.body)
        except (TypeError, json.JSONDecodeError):
            return JsonResponse({"errors": {"__all__": ["Передайте корректный JSON."]}}, status=400)

        form = ReceiptCreateForm(payload)
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
@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


@require_GET
def health(request):
    return JsonResponse({"status": "ok"})


def register(request):
    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect("/")
    else:
        form = UserCreationForm()
    return render(request, "registration/register.html", {"form": form})

