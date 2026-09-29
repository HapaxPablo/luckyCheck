"use client";

import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { CabinetHeader } from "./cabinet-header";

type Props = { promoStart: string; promoEnd: string };
type FormValues = {
  fn: string;
  fd: string;
  fp: string;
  purchased_at: string;
  amount: string;
};
type Errors = Partial<
  Record<keyof FormValues | "receipt_photo" | "__all__", string>
>;

const emptyValues: FormValues = {
  fn: "",
  fd: "",
  fp: "",
  purchased_at: "",
  amount: "",
};
const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
const maxPhotoSize = 5 * 1024 * 1024;

function getCookie(name: string) {
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${name}=`))
      ?.split("=")[1] ?? ""
  );
}

function parseQr(value: string): Partial<FormValues> | null {
  const params = new URLSearchParams(value.trim().replace(/^.*\?/, ""));
  const date = params.get("t");
  const amount = params.get("s");
  const fn = params.get("fn");
  const fd = params.get("i");
  const fp = params.get("fp");
  if (!date || !amount || !fn || !fd || !fp) return null;
  return {
    fn,
    fd,
    fp,
    purchased_at: date
      .replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/, "$1-$2-$3T$4:$5")
      .slice(0, 16),
    amount: amount.replace(",", "."),
  };
}

function validate(
  values: FormValues,
  photo: File | null,
  promoStart: string,
  promoEnd: string,
): Errors {
  const errors: Errors = {};
  const fiscalRules = {
    fn: [16],
    fd: Array.from({ length: 10 }, (_, index) => index + 1),
    fp: [8, 10],
  };
  const fiscalLabels = { fn: "16", fd: "от 1 до 10", fp: "8 или 10" };
  (["fn", "fd", "fp"] as const).forEach((field) => {
    if (!values[field]) errors[field] = "Заполните поле.";
    else if (!/^\d+$/.test(values[field]))
      errors[field] = "Допустимы только цифры.";
    else if (!fiscalRules[field].includes(values[field].length))
      errors[field] = `Введите ${fiscalLabels[field]} цифр.`;
  });
  if (!values.purchased_at)
    errors.purchased_at = "Укажите дату и время покупки.";
  else {
    const date = values.purchased_at.slice(0, 10);
    if (promoStart && promoEnd && (date < promoStart || date > promoEnd))
      errors.purchased_at = "Дата покупки не входит в период акции.";
  }
  const amount = Number(values.amount.replace(",", "."));
  if (!values.amount) errors.amount = "Укажите сумму чека.";
  else if (!Number.isFinite(amount) || amount < 1000)
    errors.amount = "Сумма должна быть не меньше 1 000 ₽.";
  if (photo) {
    if (!allowedPhotoTypes.includes(photo.type))
      errors.receipt_photo = "Можно загрузить JPG, PNG или WebP.";
    else if (photo.size > maxPhotoSize)
      errors.receipt_photo = "Размер фотографии не должен превышать 5 МБ.";
  }
  return errors;
}

export function ReceiptForm({ promoStart, promoEnd }: Props) {
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [photo, setPhoto] = useState<File | null>(null);
  const [pendingQrPhoto, setPendingQrPhoto] = useState<File | null>(null);
  const [qrValue, setQrValue] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrError, setQrError] = useState("");
  const [readingImage, setReadingImage] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrImageInputRef = useRef<HTMLInputElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);

  const update = (field: keyof FormValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const applyQr = useCallback((value: string, sourcePhoto?: File) => {
    const parsed = parseQr(value);
    if (!parsed) {
      setQrError(
        "Это не QR-код кассового чека. Нужны ФН, ФД, ФП, дата и сумма.",
      );
      return false;
    }
    setValues((previous) => ({ ...previous, ...parsed }));
    setErrors({});
    setQrError("");
    setShowQr(false);
    if (sourcePhoto) setPendingQrPhoto(sourcePhoto);
    return true;
  }, []);

  useEffect(() => {
    if (!scannerOpen || !videoRef.current) return;
    const reader = new BrowserQRCodeReader();
    let disposed = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (result, _error, controls) => {
          if (!result || disposed) return;
          if (applyQr(result.getText())) {
            controls.stop();
            scannerControlsRef.current = null;
            setScannerOpen(false);
          }
        },
      )
      .then((controls) => {
        if (disposed) controls.stop();
        else scannerControlsRef.current = controls;
      })
      .catch(() => {
        if (!disposed)
          setQrError(
            "Не удалось открыть камеру. Разрешите доступ или загрузите изображение QR.",
          );
      });

    return () => {
      disposed = true;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [applyQr, scannerOpen]);

  const closeScanner = () => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScannerOpen(false);
  };

  const fillFromQr = () => {
    if (!applyQr(qrValue))
      setErrors((previous) => ({
        ...previous,
        __all__: "Не удалось прочитать QR-строку чека.",
      }));
  };

  const readQrImage = async (file: File) => {
    if (!allowedPhotoTypes.includes(file.type)) {
      setQrError("Для QR подойдут JPG, PNG или WebP.");
      return;
    }
    if (file.size > maxPhotoSize) {
      setQrError("Размер изображения QR не должен превышать 5 МБ.");
      return;
    }
    setReadingImage(true);
    setQrError("");
    const imageUrl = URL.createObjectURL(file);
    try {
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(
        imageUrl,
      );
      applyQr(result.getText(), file);
    } catch {
      setQrError(
        "QR-код на изображении не найден. Выберите более чёткий снимок.",
      );
    } finally {
      URL.revokeObjectURL(imageUrl);
      setReadingImage(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(values, photo, promoStart, promoEnd);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const csrfResponse = await fetch("/api/csrf/", {
        credentials: "same-origin",
      });
      const csrfBody = await csrfResponse.json();
      const token =
        csrfBody.csrfToken ?? decodeURIComponent(getCookie("csrftoken"));
      const formData = new FormData();
      Object.entries({
        ...values,
        amount: values.amount.replace(",", "."),
      }).forEach(([field, value]) => formData.append(field, value));
      if (photo) formData.append("receipt_photo", photo);
      const response = await fetch("/api/receipts/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRFToken": token },
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          window.location.assign("/accounts/login/?next=/");
          return;
        }
        const serverErrors: Errors = {};
        Object.entries(body.errors ?? {}).forEach(([field, messages]) => {
          const first = Array.isArray(messages) ? messages[0] : messages;
          serverErrors[field as keyof Errors] =
            typeof first === "object" && first !== null && "message" in first
              ? String(first.message)
              : String(first);
        });
        setErrors(serverErrors);
        setNotice({
          kind: "error",
          text: "Проверьте данные и попробуйте ещё раз.",
        });
        return;
      }
      setValues(emptyValues);
      setPhoto(null);
      setPendingQrPhoto(null);
      setQrValue("");
      setNotice({ kind: "success", text: "Ваш чек загружен" });
    } catch {
      setNotice({
        kind: "error",
        text: "Не удалось отправить чек. Проверьте соединение и повторите попытку.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (notice?.kind === "success")
    return (
      <main className="cabinet-page success-page">
        <CabinetHeader active="form" />
        <section className="success-card" aria-live="polite">
          <span className="success-mark" aria-hidden>
            ✓
          </span>
          <h1>{notice.text}</h1>
          <p>
            Мы уже начали анализировать ваши покупки.
            <br />
            Это займёт всего пару секунд.
          </p>
          <Link
            className="button primary-button success-action"
            href="/cabinet"
          >
            В личный кабинет
          </Link>
        </section>
      </main>
    );

  return (
    <main className="cabinet-page">
      <CabinetHeader active="form" />
      <section className="registration-card" aria-labelledby="form-title">
        <div className="card-title-row">
          <div>
            <h1 id="form-title">Регистрация чека</h1>
            <p>Введите необходимые данные с чека</p>
            <small className="promo-period">
              Период акции: {promoStart || "начало акции"} —{" "}
              {promoEnd || "конец акции"}
            </small>
          </div>
          <Link className="close-link" href="/cabinet" aria-label="Закрыть">
            ×
          </Link>
        </div>
        <form noValidate onSubmit={submit}>
          <div className="form-fields">
            <Field
              label="ФН"
              name="fn"
              value={values.fn}
              onChange={update}
              error={errors.fn}
              inputMode="numeric"
              placeholder="Введите ФН"
            />
            <Field
              label="Номер чека (ФД)"
              name="fd"
              value={values.fd}
              onChange={update}
              error={errors.fd}
              inputMode="numeric"
              placeholder="Введите номер чека"
            />
            <Field
              label="ФП"
              name="fp"
              value={values.fp}
              onChange={update}
              error={errors.fp}
              inputMode="numeric"
              placeholder="Введите ФП"
            />
            <Field
              label="Дата и время покупки"
              name="purchased_at"
              value={values.purchased_at}
              onChange={update}
              error={errors.purchased_at}
              type="datetime-local"
            />
            <Field
              label="Сумма чека"
              name="amount"
              value={values.amount}
              onChange={update}
              error={errors.amount}
              inputMode="decimal"
              placeholder="От 1 000 ₽"
            />
            <label className="field">
              <span>
                Фото чека <em>необязательно</em>
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                aria-invalid={Boolean(errors.receipt_photo)}
                onChange={(event) => {
                  const selectedPhoto = event.target.files?.[0] ?? null;
                  setPhoto(selectedPhoto);
                  setErrors((previous) => ({
                    ...previous,
                    receipt_photo: undefined,
                  }));
                }}
              />
              {photo ? (
                <span className="selected-photo">
                  <span>{photo.name}</span>
                  <button type="button" onClick={() => setPhoto(null)}>
                    Убрать
                  </button>
                </span>
              ) : (
                <small className="photo-hint">JPG, PNG или WebP, до 5 МБ</small>
              )}
              {errors.receipt_photo && (
                <small className="field-error">{errors.receipt_photo}</small>
              )}
            </label>
          </div>
          <button
            className="button primary-button submit-button"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Загружаем…" : "Зарегистрировать чек"}
          </button>
          <button
            className="qr-toggle"
            type="button"
            onClick={() => {
              setShowQr((current) => !current);
              setQrError("");
            }}
          >
            Заполнить из QR-кода
          </button>
          {showQr ? (
            <div className="qr-import">
              <label htmlFor="qr">Строка из QR-кода</label>
              <div>
                <input
                  id="qr"
                  value={qrValue}
                  onChange={(event) => setQrValue(event.target.value)}
                  placeholder="t=...&s=...&fn=..."
                />
                <button type="button" onClick={fillFromQr}>
                  Заполнить
                </button>
              </div>
              <div className="qr-actions">
                <button
                  type="button"
                  onClick={() => {
                    setQrError("");
                    setScannerOpen(true);
                  }}
                >
                  Сканировать камерой
                </button>
                <button
                  type="button"
                  disabled={readingImage}
                  onClick={() => qrImageInputRef.current?.click()}
                >
                  {readingImage ? "Читаем QR…" : "Загрузить изображение QR"}
                </button>
                <input
                  ref={qrImageInputRef}
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void readQrImage(file);
                  }}
                />
              </div>
              {qrError ? (
                <p className="field-error form-error" role="alert">
                  {qrError}
                </p>
              ) : null}
            </div>
          ) : null}
          {pendingQrPhoto ? (
            <div className="qr-photo-choice">
              <p>
                QR прочитан из «{pendingQrPhoto.name}». Прикрепить этот файл как
                фото чека?
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(pendingQrPhoto);
                    setPendingQrPhoto(null);
                  }}
                >
                  Прикрепить
                </button>
                <button type="button" onClick={() => setPendingQrPhoto(null)}>
                  Не прикреплять
                </button>
              </div>
            </div>
          ) : null}
          {errors.__all__ ? (
            <p className="field-error form-error" role="alert">
              {errors.__all__}
            </p>
          ) : null}
          {notice?.kind === "error" ? (
            <p className="form-notice error" role="alert">
              {notice.text}
            </p>
          ) : null}
        </form>
      </section>
      {scannerOpen ? (
        <div
          className="qr-scanner"
          role="dialog"
          aria-modal="true"
          aria-label="Сканирование QR-кода"
        >
          <div className="qr-scanner-card">
            <div>
              <h2>Наведите камеру на QR-код</h2>
              <button
                type="button"
                onClick={closeScanner}
                aria-label="Закрыть сканер"
              >
                ×
              </button>
            </div>
            <video ref={videoRef} muted playsInline autoPlay />
            <p>Код будет распознан автоматически.</p>
            {qrError ? (
              <p className="field-error" role="alert">
                {qrError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  inputMode,
  placeholder,
}: {
  label: string;
  name: keyof FormValues;
  value: string;
  onChange: (field: keyof FormValues, value: string) => void;
  error?: string;
  type?: string;
  inputMode?: "numeric" | "decimal";
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(name, event.target.value)}
      />
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
