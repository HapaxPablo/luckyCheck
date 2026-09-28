"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Props = { promoStart: string; promoEnd: string };
type FormValues = { fn: string; fd: string; fp: string; purchased_at: string; amount: string };
type Errors = Partial<Record<keyof FormValues | "__all__", string>>;
const emptyValues: FormValues = { fn: "", fd: "", fp: "", purchased_at: "", amount: "" };

function getCookie(name: string) { return document.cookie.split("; ").find((part) => part.startsWith(`${name}=`))?.split("=")[1] ?? ""; }
function parseQr(value: string): Partial<FormValues> | null {
  const params = new URLSearchParams(value.trim().replace(/^.*\?/, ""));
  const date = params.get("t"), amount = params.get("s"), fn = params.get("fn"), fd = params.get("i"), fp = params.get("fp");
  if (!date || !amount || !fn || !fd || !fp) return null;
  return { fn, fd, fp, purchased_at: date.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/, "$1-$2-$3T$4:$5").slice(0, 16), amount: amount.replace(",", ".") };
}
function validate(values: FormValues, promoStart: string, promoEnd: string): Errors {
  const errors: Errors = {};
  (["fn", "fd", "fp"] as const).forEach((field) => { if (!values[field]) errors[field] = "Заполните поле."; else if (!/^\d+$/.test(values[field])) errors[field] = "Допустимы только цифры."; });
  if (!values.purchased_at) errors.purchased_at = "Укажите дату и время покупки.";
  else { const date = values.purchased_at.slice(0, 10); if (promoStart && promoEnd && (date < promoStart || date > promoEnd)) errors.purchased_at = "Дата покупки не входит в период акции."; }
  const amount = Number(values.amount.replace(",", "."));
  if (!values.amount) errors.amount = "Укажите сумму чека."; else if (!Number.isFinite(amount) || amount < 1000) errors.amount = "Сумма должна быть не меньше 1 000 ₽.";
  return errors;
}
function CabinetHeader() { return <header className="cabinet-header"><Link className="wordmark" href="/">ЧЕК НА УДАЧУ</Link><Link className="back-link" href="/">‹ На сайт</Link><nav className="cabinet-nav" aria-label="Основная навигация"><Link className="nav-link active" href="/cabinet">⌂ Личный кабинет</Link><span className="nav-link">◈ Правила</span><span className="nav-link">♙ Профиль</span></nav><div className="profile-summary"><span className="notification" aria-hidden>♧</span><span className="avatar" aria-hidden>ЕИ</span><span><b>Елена Иванова</b><small>nameuser@email.com</small></span></div></header>; }

export function ReceiptForm({ promoStart, promoEnd }: Props) {
  const [values, setValues] = useState<FormValues>(emptyValues), [qrValue, setQrValue] = useState(""), [showQr, setShowQr] = useState(false), [errors, setErrors] = useState<Errors>({}), [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null), [submitting, setSubmitting] = useState(false);
  const update = (field: keyof FormValues, value: string) => { setValues((previous) => ({ ...previous, [field]: value })); setErrors((previous) => ({ ...previous, [field]: undefined })); };
  const fillFromQr = () => { const parsed = parseQr(qrValue); if (!parsed) { setErrors((previous) => ({ ...previous, __all__: "Не удалось прочитать QR-строку чека." })); return; } setValues((previous) => ({ ...previous, ...parsed })); setErrors({}); setShowQr(false); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const nextErrors = validate(values, promoStart, promoEnd); setErrors(nextErrors); if (Object.keys(nextErrors).length) return; setSubmitting(true);
    try { const csrfResponse = await fetch("/api/csrf/", { credentials: "same-origin" }); const csrfBody = await csrfResponse.json(); const token = csrfBody.csrfToken ?? decodeURIComponent(getCookie("csrftoken")); const response = await fetch("/api/receipts/", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRFToken": token }, body: JSON.stringify({ ...values, amount: values.amount.replace(",", ".") }) }); const body = await response.json(); if (!response.ok) { if (response.status === 401) { window.location.assign("/accounts/login/?next=/"); return; } const serverErrors: Errors = {}; Object.entries(body.errors ?? {}).forEach(([field, messages]) => { const first = Array.isArray(messages) ? messages[0] : messages; serverErrors[field as keyof Errors] = typeof first === "object" && first !== null && "message" in first ? String(first.message) : String(first); }); setErrors(serverErrors); setNotice({ kind: "error", text: "Проверьте данные и попробуйте ещё раз." }); return; } setValues(emptyValues); setQrValue(""); setNotice({ kind: "success", text: "Ваш чек загружен" }); } catch { setNotice({ kind: "error", text: "Не удалось отправить чек. Проверьте соединение и повторите попытку." }); } finally { setSubmitting(false); }
  };
  if (notice?.kind === "success") return <main className="cabinet-page success-page"><CabinetHeader /><section className="success-card" aria-live="polite"><span className="success-mark" aria-hidden>✓</span><h1>{notice.text}</h1><p>Мы уже начали анализировать ваши покупки.<br />Это займет всего пару секунд.</p><Link className="button primary-button success-action" href="/">На главную</Link></section></main>;
  return <main className="cabinet-page"><CabinetHeader /><section className="registration-card" aria-labelledby="form-title"><div className="card-title-row"><div><h1 id="form-title">Регистрация чека</h1><p>Введите необходимые данные с чека</p></div><Link className="close-link" href="/cabinet" aria-label="Закрыть">×</Link></div><form noValidate onSubmit={submit}><div className="form-fields"><Field label="ФН" name="fn" value={values.fn} onChange={update} error={errors.fn} inputMode="numeric" placeholder="Введите ФН" /><Field label="Номер чека" name="fd" value={values.fd} onChange={update} error={errors.fd} inputMode="numeric" placeholder="Введите номер чека (ФД)" /><Field label="ФП" name="fp" value={values.fp} onChange={update} error={errors.fp} inputMode="numeric" placeholder="Введите ФП" /><Field label="Дата покупки" name="purchased_at" value={values.purchased_at} onChange={update} error={errors.purchased_at} type="datetime-local" /><Field label="Сумма" name="amount" value={values.amount} onChange={update} error={errors.amount} inputMode="decimal" placeholder="0.00 ₽" /></div><button className="button primary-button submit-button" disabled={submitting} type="submit">{submitting ? "Загружаем…" : "Загрузить"}</button><button className="qr-toggle" type="button" onClick={() => setShowQr((current) => !current)}>Заполнить из QR-кода</button>{showQr && <div className="qr-import"><label htmlFor="qr">Строка из QR-кода</label><div><input id="qr" value={qrValue} onChange={(event) => setQrValue(event.target.value)} placeholder="t=...&s=...&fn=..." /><button type="button" onClick={fillFromQr}>Заполнить</button></div></div>}{errors.__all__ && <p className="field-error form-error" role="alert">{errors.__all__}</p>}{notice?.kind === "error" && <p className="form-notice error" role="alert">{notice.text}</p>}</form></section></main>;
}
function Field({ label, name, value, onChange, error, type = "text", inputMode, placeholder }: { label: string; name: keyof FormValues; value: string; onChange: (field: keyof FormValues, value: string) => void; error?: string; type?: string; inputMode?: "numeric" | "decimal"; placeholder?: string }) { return <label className="field"><span>{label}</span><input type={type} value={value} inputMode={inputMode} placeholder={placeholder} aria-invalid={Boolean(error)} onChange={(event) => onChange(name, event.target.value)} />{error && <small className="field-error">{error}</small>}</label>; }
