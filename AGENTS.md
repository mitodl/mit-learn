# MIT Learn - Agent Instructions

This is a Django/Next.js application for browsing and searching MIT learning resources aggregated from multiple platforms (OCW, MITx, xPRO, etc.).

## Architecture Overview

MIT Learn is a **hybrid Django + Next.js monorepo** with these major components:

### Backend (Django + Celery)

- **Django REST API** using DRF + drf-spectacular for OpenAPI generation
- **ETL Pipelines** in `learning_resources/etl/` extract, transform, and load data from external sources (OCW, edX, xPRO, MITx Online, Canvas, YouTube, podcasts, etc.)
- **OpenSearch** for full-text search with embeddings and hybrid search support
- **Celery** for async task processing (ETL, indexing, notifications)
- **Vector Search** using Qdrant for AI-powered recommendations and semantic search
- **Keycloak + APISIX** for authentication (see README-keycloak.md)

Key Django apps:

- `learning_resources` - Core models (LearningResource, Course, Program, ContentFile, etc.) and ETL pipelines
- `learning_resources_search` - OpenSearch indexing and search API
- `channels` - Community channels/groups
- `articles` - User-created articles with CKEditor
- `authentication` - Auth middleware and user management
- `vector_search` - Qdrant integration for embeddings
- `webhooks` - External webhook handlers (OCW, YouTube, etc.)

### Frontend (Next.js App Router)

Located in `frontends/` as a **Yarn workspaces monorepo**:

- `main/` - Next.js 14+ app using App Router (NOT pages router)
- `api/` - Generated TypeScript API client from OpenAPI spec
- `ol-components/` - Shared React components
- `ol-search-ui/`, `ol-forms/`, `ol-utilities/` - Reusable packages
- Uses `@mitodl/smoot-design` for design system components
- Root-relative imports via `@/` in the `main` workspace

## Build, Test, and Lint Commands

### Backend (Python)

Run inside Docker containers with `docker compose`:

```bash
# Run all tests (parallel)
docker compose run --rm web uv run pytest -n logical

# Run specific test file
docker compose run --rm web uv run pytest learning_resources/models_test.py

# Run specific test
docker compose run --rm web uv run pytest learning_resources/models_test.py::test_name -v

# Lint and format with ruff
docker compose run --rm web uv run ruff format .
docker compose run --rm web uv run ruff check . --fix

# Run Django management commands
docker compose run --rm web python manage.py <command>

# Create migrations
docker compose run --rm web python manage.py makemigrations

# Run migrations
docker compose run --rm web python manage.py migrate

# Create superuser
docker compose run --rm web python manage.py createsuperuser
```

### Frontend (TypeScript/React)

From project root (not `frontends/` directory):

```bash
# Run all tests
yarn test

# Run tests for specific file
yarn test path/to/file.test.tsx

# Watch mode
yarn test-watch

# Lint
yarn workspace frontends run lint-check
yarn workspace frontends run lint-fix

# Type checking
yarn workspace frontends run typecheck

# Style linting (CSS/SCSS)
yarn workspace frontends run style-lint

# Format with Prettier
yarn workspace frontends run fmt-check
yarn workspace frontends run fmt-fix

# Build frontend
yarn build

# Run dev server (inside Docker)
docker compose up

# Run dev server (on host)
yarn watch
```

### E2E Tests (Playwright)

```bash
# Run Playwright tests
yarn playwright

# UI mode
yarn playwright:ui

# View report
yarn playwright:report
```

### Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit
pre-commit install

# Run all checks
pre-commit run --all-files
```

## Code Generation

### OpenAPI Client Generation

The TypeScript API client in `frontends/api/src/generated/` is auto-generated from the Django API using drf-spectacular:

```bash
# Regenerate OpenAPI spec and TypeScript client
./scripts/generate_openapi.sh
```

**CI will fail if generated code is out of sync** - always regenerate after changing Django views/serializers.

## Key Conventions

### Python/Django

- Use **Ruff** for linting and formatting (configured in `pyproject.toml`)
- **Factory Boy** for test data - all factories in `<app>/factories.py`
- **Named Enums** - use `named_enum.ExtendedEnum` for constants (see `learning_resources/constants.py`)
- **Serializers** - use DRF serializers with `COMMON_IGNORED_FIELDS` exclusion pattern
- **Permissions** - use Django Guardian for object-level permissions
- **Views** - use DRF ViewSets with drf-spectacular decorators (`@extend_schema`)
- **Tests** - pytest-django with `conftest.py`, fixture-based setup, auto-mock external requests
- **Migrations** - all migrations must be non-auto and tested (see `scripts/test/no_auto_migrations.sh`)
- Never import `django.contrib.auth.models.User` directly - use `get_user_model()` or `settings.AUTH_USER_MODEL`

### TypeScript/React/Next.js

- **Next.js App Router** (NOT pages router) - routes in `frontends/main/src/app/`
- **React Query** - API calls via generated hooks from `api/` package
- **Test factories** - mock API responses with `setMockResponse` from `api/test-utils`
- **Styling** - CSS Modules or components from `@mitodl/smoot-design` and `ol-components`
- **Root imports** - use `@/` prefix in `main` workspace (e.g., `@/components`, `@/test-utils`)
- **Yarn workspaces** - run commands with `yarn workspace <name> run <script>` or use `global:*` scripts
- Frontend tests covered in `.github/instructions/frontend-tests.instructions.md`

### ETL Pipelines

ETL pipelines in `learning_resources/etl/` follow a common pattern:

- Each source has its own module (e.g., `ocw.py`, `mit_edx.py`, `xpro.py`)
- Management commands in `learning_resources/management/commands/` trigger pipelines
- Pipelines are scheduled via Celery Beat (configured in `main/settings_celery.py`)
- After loading data, run `python manage.py recreate_index --all` to index in OpenSearch
- Environment variables in `main/settings_course_etl.py` configure API endpoints

Example ETL commands:

```bash
docker compose run --rm web python manage.py backpopulate_ocw_data
docker compose run --rm web python manage.py backpopulate_xpro_data
docker compose run --rm web python manage.py backpopulate_mit_edx_data
```

### Search Architecture

MIT Learn uses **OpenSearch** with:

- **Hybrid search** - combines keyword and vector similarity
- **Embeddings** - stored in Qdrant, queried via `vector_search/` app
- **Indexing** - via `learning_resources_search/indexing_api.py`
- **Percolator queries** - for saved search notifications

Key management commands:

```bash
# Recreate search indices
docker compose run --rm web python manage.py recreate_index --all

# Index specific resources
docker compose run --rm web python manage.py index_learning_resources
```

## Docker Compose Profiles

Control which containers run via `COMPOSE_PROFILES` in `.env`:

- `backend` - Django API, Celery, PostgreSQL, Redis
- `frontend` - Next.js watch server
- `keycloak` - Keycloak auth server
- `apisix` - API gateway

Example: `COMPOSE_PROFILES=backend,frontend,keycloak,apisix`

## Environment Configuration

Environment variables in `env/` directory:

- `env/shared.local.env` - Both frontend and backend
- `env/backend.local.env` - Backend only
- `env/frontend.local.env` - Frontend only

Required variables:

- `COMPOSE_PROFILES` - Which containers to run
- `MAILGUN_KEY`, `MAILGUN_SENDER_DOMAIN` - Email (can be dummy values for local dev)
- API URLs for ETL sources (see `main/settings_course_etl.py`)

## Local Development Tips

### Running Backend Only

Set `COMPOSE_PROFILES=backend` and run frontend on host with `yarn watch` for better performance.

### Loading Test Data

```bash
# Load fixture data (platforms, departments, etc.)
docker compose run --rm web python manage.py loaddata platforms departments offered_by

# Run specific ETL pipeline
docker compose run --rm web python manage.py backpopulate_ocw_data

# Create search indices
docker compose run --rm web python manage.py recreate_index --all
```

### Disabling Scheduled Tasks

Add `CELERY_BEAT_DISABLED=True` to `backend.local.env` to disable scheduled Celery tasks.

### OpenSearch Cluster vs Single Node

By default, OpenSearch runs in single-node mode. For multi-node cluster:

```bash
export OPENSEARCH_CLUSTER_TYPE=cluster
```

### Debugging

- Backend: Use `ipdb` or `pdb` - breakpoints work in `docker compose up` logs
- Frontend: Use browser DevTools - source maps enabled in dev mode
- Celery: Check `celery` container logs with `docker compose logs -f celery`

## Authentication Architecture

MIT Learn uses **Keycloak** for authentication with **APISIX** as an API gateway. The flow:

1. User authenticates via Keycloak (OAuth2/OIDC)
2. APISIX validates tokens and adds user info headers
3. Django middleware (`main.middleware.apisix_user`) creates/updates Django user from headers

See `README-keycloak.md` for full setup.

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

- Runs pytest with coverage
- Checks migrations are non-auto
- Validates OpenAPI spec is up-to-date
- Runs frontend tests and linting
- Builds Docker images

## Storybook

Component documentation published at https://mitodl.github.io/mit-learn/

Run locally:

```bash
yarn storybook
```
