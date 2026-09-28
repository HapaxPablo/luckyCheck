# Repository Guidelines

## Project Structure & Module Organization

This is a two-service promo application. `frontend/` is a Next.js 15 app;
routes and UI live in `frontend/app/`, with page-specific components beside
their routes (for example, `app/cabinet/cabinet.tsx`). `backend/` is a Django
5 project: `lucky_check/` holds configuration and `receipts/` holds models,
forms, views, URLs, admin configuration, migrations, and tests. Authentication
templates are in `backend/templates/registration/`. Root infrastructure files
include `docker-compose.yml` and `.env.example`.

## Build, Test, and Development Commands

Run commands from the named service directory unless noted otherwise.

- `cd frontend; npm ci` installs locked frontend dependencies.
- `cd frontend; npm run dev` starts development mode; `npm run build` creates
  a production build and `npm run lint` runs ESLint.
- `cd backend; python -m venv .venv` then `.venv\\Scripts\\pip install -r requirements.txt`
  creates and populates a local Python environment on Windows.
- `cd backend; $env:USE_SQLITE='true'; python manage.py migrate` prepares a
  local SQLite database, avoiding a PostgreSQL dependency.
- `cd backend; $env:USE_SQLITE='true'; python manage.py runserver` starts
  Django. Run `python manage.py check` before submitting backend changes.
- From the root, `docker compose up --build` runs the full PostgreSQL, Django,
  and Next.js stack when Docker is available.

## Coding Style & Naming Conventions

Use four-space indentation and PEP 8-style `snake_case` in Python. Keep Django
behavior in `receipts` and create migrations with `python manage.py
makemigrations` when models change. TypeScript is strict; use PascalCase React
components and the existing lowercase/hyphenated file pattern (such as
`receipt-form.tsx`). Use `npm run lint`; do not add generated `.next/`, virtual
environment, or database files.

## Testing Guidelines

Django tests use `django.test.TestCase` in `backend/receipts/tests/` and methods
named `test_<expected_behavior>`. Run all tests with `cd backend;
$env:USE_SQLITE='true'; python manage.py test`, or target the app with `python
manage.py test receipts`. Cover validation, ownership, and API changes; retain
authentication and pagination cases.

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
Review promo date and allowed-host settings before deployment.
