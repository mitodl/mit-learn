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
  covering the settings discovered from `main.settings` and its companions. Generation is driven by
  the `[tool.aqueduct]` table in `pyproject.toml`, which lists the settings modules statically
  scanned (`main.settings_celery`, `main.settings_course_etl`, `main.settings_pluggy`,
  `main.settings`) plus the mitol `EnvParser` registry; regenerate and check for drift with:

  ```bash
  # regenerate (merges into the machine-owned `# >>> aqueduct:generated:*` regions)
  python manage.py generate_aqueduct_settings
  # CI drift check — fails if the on-disk file is out of date
  python manage.py generate_aqueduct_settings --check
  ```

  Hand-written code lives in the `# >>> aqueduct:preserved:*` regions (and anywhere outside a
  generated region) and survives regeneration:

  - `SECRET_KEY` and `WEBHOOK_SECRET` are **required** fields with no default (the old hardcoded
    insecure fallbacks are intentionally not reproduced).
  - `model_validator`s reproduce the derived/conditional logic from `main/settings*.py`: the
    Celery embeddings lookback window, the `REDIS_URL`/`REDISCLOUD_URL` fallback chain (and the
    Celery broker/result backend and Redis cache location that depend on it), the
    `DATABASES`/`DEFAULT_DATABASE_CONFIG` construction from `DATABASE_URL` (via
    `django_aqueduct.derivations`), the `TEMPLATES` dirs (both of which depend on `BASE_DIR`),
    `COOKIE_TOMBSTONES` parsing, the full `CELERY_BEAT_SCHEDULE` / `CELERY_BEAT_SCHEDULER` (rebuilt
    from typed schedule-interval fields so the model is safe to run under the Celery worker/beat),
    and the conditional `INSTALLED_APPS`/`MIDDLEWARE` additions (zeal profiler, cookie tombstone
    middleware, nplusone profiler, feature-flag middleware).
  - `manage.py check_aqueduct_settings` compares the model's resolved values against `main.settings`
    and fails on unexplained drift; deliberate divergences are enumerated with justifications in
    `[tool.aqueduct] parity_ignore`.

- `main/settings_aqueduct.py` — a thin shim (`configure_django_settings(AqueductSettings)`) that
  reads settings from environment variables only, mirroring today's deployment model.
- `main/settings_aqueduct_dev.py` — the same shim using `DevAqueductSettings`, which layers a
  HashiCorp Vault source on top so local development can pull values from Vault instead of a full
  `.env` file. `DevAqueductSettings` builds on `django_aqueduct.sources.dev.VaultDevBase`, which is
  configured entirely from `VAULT_*` environment variables and _prepends_ the Vault source (Vault
  values win over local env vars):

  | Variable            | Purpose                                                                                   |
  | ------------------- | ----------------------------------------------------------------------------------------- |
  | `VAULT_ADDR`        | Vault server URL. Unset → Vault is skipped and the model runs from env only.              |
  | `VAULT_MOUNT`       | KV mount point (e.g. `secret-mitlearn`). Default `secret`.                                |
  | `VAULT_PATH`        | KV secret path. Required when `VAULT_ADDR` is set.                                        |
  | `VAULT_KV_VERSION`  | `1` or `2`. Default `2`.                                                                  |
  | `VAULT_AUTH_METHOD` | `token` \| `oidc` \| `kubernetes`. Default `token`; use `oidc` for interactive dev login. |
  | `VAULT_ROLE`        | Role name for `oidc`/`kubernetes` auth.                                                   |

  Misconfiguration (e.g. `VAULT_ADDR` set without `VAULT_PATH`) raises an actionable
  `VaultConfigError` rather than a bare `KeyError`.

## Selecting an aqueduct settings module

Set `DJANGO_SETTINGS_MODULE` to one of the new modules instead of `main.settings`:

```bash
# Environment-variable-only, same inputs as main.settings today
DJANGO_SETTINGS_MODULE=main.settings_aqueduct python manage.py check

# Local dev: layers a Vault source (configured via VAULT_* env vars) over the environment
DJANGO_SETTINGS_MODULE=main.settings_aqueduct_dev python manage.py runserver
```

`main.settings` is unaffected by this and remains the default `DJANGO_SETTINGS_MODULE` used by
Docker Compose, CI, and production deployments unless explicitly overridden.
