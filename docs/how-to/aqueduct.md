---
parent: How-To
nav_order: 2
---

# django-aqueduct settings (opt-in)

[`django-aqueduct`](https://github.com/mitodl/django-aqueduct) is a typed, Pydantic-based settings
framework that can source Django settings from environment variables, HashiCorp Vault, AWS SSM
Parameter Store, and more. mit-learn has an **opt-in, non-disruptive** integration with it:
`main/settings.py` (and its `settings_celery.py` / `settings_course_etl.py` / `settings_pluggy.py`
companions) are untouched and remain the default settings module everywhere they are already
configured today (Docker Compose, CI, Heroku, etc.).

## What was added

- `main/aqueduct_settings.py` — a typed `AqueductSettings(pydantic_settings.BaseSettings)` model
  covering the settings discovered from `main.settings` (which pulls in `settings_celery`,
  `settings_course_etl`, `settings_pluggy`, and `mitol.scim.settings.scim` via wildcard imports).
  It was generated with `python manage.py generate_aqueduct_settings --modules main.settings` and
  then hand-refined:
  - `SECRET_KEY` and `WEBHOOK_SECRET` are **required** fields with no default (the old hardcoded
    insecure fallbacks are intentionally not reproduced).
  - `model_validator`s reproduce the derived/conditional logic from `main/settings*.py`: the
    Celery embeddings lookback window, the `REDIS_URL`/`REDISCLOUD_URL` fallback chain (and the
    Celery broker/result backend and Redis cache location that depend on it), the
    `DATABASES`/`DEFAULT_DATABASE_CONFIG` construction from `DATABASE_URL`, the `TEMPLATES` dirs
    (both of which depend on `BASE_DIR`), `COOKIE_TOMBSTONES` parsing, and the conditional
    `INSTALLED_APPS`/`MIDDLEWARE` additions (zeal profiler, cookie tombstone middleware, nplusone
    profiler, feature-flag middleware).
  - A few settings are intentionally left as generated placeholders — see the header comment in
    `main/aqueduct_settings.py` for what was skipped and why (mainly `CELERY_BEAT_SCHEDULE` /
    `CELERY_BEAT_SCHEDULER`, which embed non-serialisable `crontab` objects and a scheduler class
    reference, and are static task-schedule config rather than environment-driven settings).
- `main/settings_aqueduct.py` — a thin shim (`configure_django_settings(AqueductSettings)`) that
  reads settings from environment variables only, mirroring today's deployment model.
- `main/settings_aqueduct_dev.py` — the same shim using `DevAqueductSettings`, which additionally
  falls back to HashiCorp Vault (via OIDC login) for any values missing from the environment, so
  local development doesn't require a full `.env` file. **The Vault path and OIDC role in
  `DevAqueductSettings.settings_customise_sources` are placeholders** — confirm them against the
  live Vault instance (e.g. `vault kv list secret-mitlearn/`) before relying on this.

## Selecting an aqueduct settings module

Set `DJANGO_SETTINGS_MODULE` to one of the new modules instead of `main.settings`:

```bash
# Environment-variable-only, same inputs as main.settings today
DJANGO_SETTINGS_MODULE=main.settings_aqueduct python manage.py check

# Local dev: falls back to Vault (OIDC) for anything not set in the environment
DJANGO_SETTINGS_MODULE=main.settings_aqueduct_dev python manage.py runserver
```

`main.settings` is unaffected by this and remains the default `DJANGO_SETTINGS_MODULE` used by
Docker Compose, CI, and production deployments unless explicitly overridden.
