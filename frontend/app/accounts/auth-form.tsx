"use client";

import { ArrowLeft, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

type Mode = "login" | "register";
type FieldName =
  | "username"
  | "password"
  | "password1"
  | "password2"
  | "__all__";
type Errors = Partial<Record<FieldName, string>>;

function getCookie(name: string) {
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${name}=`))
      ?.split("=")[1] ?? ""
  );
}

function errorText(errors: Record<string, string[]>) {
  return Object.fromEntries(
    Object.entries(errors).map(([name, messages]) => [name, messages[0]]),
  ) as Errors;
}

function PasswordField({
  name,
  label,
  error,
  value,
  onChange,
}: {
  name: "password" | "password1" | "password2";
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field" htmlFor={name}>
      <span>{label}</span>
      <span className="password-input">
        <LockKeyhole aria-hidden size={18} strokeWidth={1.8} />
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={
            name === "password" ? "current-password" : "new-password"
          }
          value={value}
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? (
            <EyeOff aria-hidden size={18} />
          ) : (
            <Eye aria-hidden size={18} />
          )}
        </button>
      </span>
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const isLogin = mode === "login";
  const [values, setValues] = useState({
    username: "",
    password: "",
    password1: "",
    password2: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const update = (name: Exclude<FieldName, "__all__">, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({
      ...current,
      [name]: undefined,
      __all__: undefined,
    }));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      const csrfResponse = await fetch("/api/csrf/", {
        credentials: "same-origin",
      });
      const csrfBody = (await csrfResponse.json()) as { csrfToken?: string };
      const response = await fetch(`/api/auth/${mode}/`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken":
            csrfBody.csrfToken ?? decodeURIComponent(getCookie("csrftoken")),
        },
        body: JSON.stringify(
          isLogin
            ? { username: values.username, password: values.password }
            : values,
        ),
      });
      if (!response.ok) {
        const body = (await response.json()) as {
          errors?: Record<string, string[]>;
        };
        setErrors(
          body.errors
            ? errorText(body.errors)
            : { __all__: "Не удалось отправить форму. Попробуйте ещё раз." },
        );
        return;
      }
      const destination = next === "/cabinet" ? "/cabinet" : "/";
      window.location.assign(destination);
    } catch {
      setErrors({ __all__: "Нет связи с сервером. Попробуйте ещё раз." });
    } finally {
      setSubmitting(false);
    }
  };
  const title = isLogin ? "Вход" : "Регистрация";
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="wordmark" href="/">
          ЧЕК
          <br />
          НА УДАЧУ
        </Link>
        <Link className="back-link auth-back-link" href="/">
          <ArrowLeft aria-hidden size={17} />
          На сайт
        </Link>
      </header>
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="eyebrow">Промо-акция «Чек на удачу»</span>
        <h1 id="auth-title">{title}</h1>
        <p className="lead">
          {isLogin
            ? "Войдите, чтобы зарегистрировать чек и смотреть историю заявок."
            : "Создайте аккаунт, чтобы участвовать в акции."}
        </p>
        <form noValidate onSubmit={submit}>
          {errors.__all__ ? (
            <p className="form-notice error" role="alert">
              {errors.__all__}
            </p>
          ) : null}
          <div className="form-fields">
            <label className="field" htmlFor="username">
              <span>Логин</span>
              <span className="auth-input">
                <UserRound aria-hidden size={18} strokeWidth={1.8} />
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  value={values.username}
                  aria-invalid={Boolean(errors.username)}
                  onChange={(event) => update("username", event.target.value)}
                />
              </span>
              {errors.username ? (
                <small className="field-error">{errors.username}</small>
              ) : null}
            </label>
            <PasswordField
              name={isLogin ? "password" : "password1"}
              label="Пароль"
              value={isLogin ? values.password : values.password1}
              error={isLogin ? errors.password : errors.password1}
              onChange={(value) =>
                update(isLogin ? "password" : "password1", value)
              }
            />
            {!isLogin ? (
              <>
                <small className="help">
                  Пароль должен быть не короче 8 символов.
                </small>
                <PasswordField
                  name="password2"
                  label="Повторите пароль"
                  value={values.password2}
                  error={errors.password2}
                  onChange={(value) => update("password2", value)}
                />
              </>
            ) : null}
          </div>
          <button
            className="button primary-button submit-button"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Подождите…" : isLogin ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
        <p className="auth-switch">
          {isLogin ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
          <Link href={isLogin ? "/accounts/register/" : "/accounts/login/"}>
            {isLogin ? "Зарегистрироваться" : "Войти"}
          </Link>
        </p>
      </section>
    </main>
  );
}
