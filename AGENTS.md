# Стиль общения

- Отвечай пользователю на русском языке в стиле первобытного человека: короткими, простыми фразами и с нарочито примитивной грамматикой.
- Называй себя «Тумба-Юмба» или «нейронка», а пользователя — «человек».
- Иногда используй уместные обороты: «Тумба-Юмба думать», «человек хотеть — нейронка делать», «код работать хорошо».
- Не злоупотребляй стилем: ответ должен оставаться понятным, профессиональным и полезным.
- Код, команды, пути, API и технические термины пиши точно, без намеренных ошибок.
- Предупреждения об опасных действиях и неоднозначных требованиях формулируй ясно. Стиль не должен скрывать смысл.
- Упрощай только манеру речи, но не рассуждение, техническую точность или качество результата.

# Repository Guidelines

## Project Structure & Module Organization

This is a two-service promo application. `frontend/` is a Next.js 15 app;
routes and UI live in `frontend/app/`, with page-specific components beside
their routes (for example, `app/cabinet/cabinet.tsx`). The receipt workflow is
implemented in `app/receipt-form.tsx`; QR parsing/scanning and optional receipt
photo upload live there. `app/realtime-provider.tsx` owns authentication state,
notifications, and WebSocket reconnection; `app/cabinet/cabinet.tsx` owns the
receipt history and CSV export. `backend/` is a Django 5 project:
`lucky_check/` holds configuration and ASGI setup, while `receipts/` holds
models, forms, HTTP views/URLs, admin configuration, migrations, tests, and
Channels realtime code in `consumers.py`, `routing.py`, and `signals.py`.
Authentication templates are in `backend/templates/registration/`. Root
infrastructure files include `docker-compose.yml`, `nginx/default.conf`, and
`.env.example`.

## Build, Test, and Development Commands

Run commands from the named service directory unless noted otherwise.

- `cd frontend; npm ci` installs locked frontend dependencies.
- `cd frontend; npm run dev` starts development mode; `npm run build` creates
  a production build, `npm run lint` runs ESLint, and `npx tsc --noEmit`
  performs the TypeScript check.
- `cd backend; python -m venv .venv` then `.venv\\Scripts\\pip install -r requirements.txt`
  creates and populates a local Python environment on Windows.
- `cd backend; $env:USE_SQLITE='true'; python manage.py migrate` prepares a
  local SQLite database, avoiding a PostgreSQL dependency. Realtime still
  requires Redis when running the WebSocket path locally.
- `cd backend; $env:USE_SQLITE='true'; python manage.py runserver` starts
  Django. Run `python manage.py check`, `python manage.py test`, and
  `python manage.py makemigrations --check --dry-run` before submitting
  backend changes.
- From the root, `docker compose up --build` runs PostgreSQL, Redis, Django via
  Daphne, Next.js, and Nginx when Docker is available.

## Coding Style & Naming Conventions

Use four-space indentation and PEP 8-style `snake_case` in Python. Keep Django
behavior in `receipts` and create migrations with `python manage.py
makemigrations` when models change. TypeScript is strict; use PascalCase React
components and the existing lowercase/hyphenated file pattern (such as
`receipt-form.tsx`). Use `npm run lint` and `npx tsc --noEmit`; do not add
generated `.next/`, virtual environment, SQLite database, media uploads, or
environment files.

## Testing Guidelines

Django tests use `django.test.TestCase` in `backend/receipts/tests/` and methods
named `test_<expected_behavior>`. Run all tests with `cd backend;
$env:USE_SQLITE='true'; python manage.py test`, or target the app with `python
manage.py test receipts`. Cover validation, ownership, authentication,
pagination, and API changes. WebSocket tests use the in-memory channel layer;
the Redis-backed production path and frontend UI currently have no dedicated
automated tests.

## Commit & Pull Request Guidelines

History uses Conventional Commit-style subjects, such as `feat(backend): add
receipt moderation` and `docs(readme): update run instructions`. Use
`type(scope): concise imperative summary`, with scopes such as `backend`,
`frontend`, or `readme`, and keep commits focused. Pull requests should
describe the change, link the task or issue, list commands run, and include
screenshots for visible frontend changes. Note migration or environment changes.

## Configuration & Security

Copy `.env.example` to `.env`; never commit it. Set a non-default
`DJANGO_SECRET_KEY` and database password outside throwaway development. For
local SQLite work, set `USE_SQLITE=true`; PostgreSQL uses `POSTGRES_*` variables.
`PROMO_START_DATE` and `PROMO_END_DATE` are required by the server-side receipt
form. Review promo dates, Redis/channel-layer settings, CORS/CSRF origins, and
allowed hosts before deployment. Nginx proxies `/api`, `/ws`, and `/media`;
Next.js serves `/accounts`, while the staff admin is available through
`admin.localhost`.
