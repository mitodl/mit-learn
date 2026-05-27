# API workspace runtime client configuration

## Status

Approved for implementation planning on 2026-05-27.

## Problem

`frontends/api` currently reads deployment/runtime configuration directly from `process.env` in production and test-support code, including:

- `frontends/api/src/axios.ts`
- `frontends/api/src/clients.ts`
- `frontends/api/src/mitxonline/clients.ts`
- `frontends/api/src/mitxonline/hooks/baskets/index.ts`
- `frontends/api/src/test-utils/urls.ts`
- `frontends/api/src/mitxonline/test-utils/urls.ts`

That conflicts with the runtime-env direction in `tmacey/nextjs-deployment-simplification`, where `frontends/main` should be the layer that reads environment variables through `env(...)` at runtime. Shared workspaces should not depend on build-time or runtime environment globals.

`process.env.NODE_ENV` usage for development-only behavior is not part of this problem statement and may remain where appropriate.

## Goals

1. Remove deployment/runtime configuration reads from `frontends/api`.
2. Keep the current singleton-style API exports and existing hook usage patterns.
3. Make configuration easy for `frontends/main` to provide from `env(...)`.
4. Preserve support for both Learn API and MITx Online API configuration.
5. Keep manual axios requests and generated client requests aligned on the same runtime configuration.

## Non-goals

1. Introduce full dependency injection across query helpers and hooks.
2. Redesign the `frontends/api` public hook surface, except for moving the MITx Online cart redirect orchestration hook into `frontends/main`.
3. Move the `env(...)` helper into another workspace.

## Decision

Use a **singleton configuration step per runtime** inside `frontends/api`.

`frontends/main` will read runtime env values with `env(...)` and pass a typed configuration object into `frontends/api` in both server and browser runtimes before the first request is executed. `frontends/api` will use that configuration to set up its singleton axios instances and generated API clients. The workspace itself will no longer read `process.env`.

This design depends on the runtime `env(...)` helper from `tmacey/nextjs-deployment-simplification` (or an equivalent landing in `frontends/main`). That helper does not exist on this branch today, so this work must sequence behind that runtime-env capability.

## Proposed design

### Configuration API

`frontends/api` will export a one-time configuration entry point, conceptually:

```ts
type LearnApiConfig = {
  baseUrl: string
  csrfCookieName: string
  withCredentials: boolean
}

type MitxOnlineApiConfig = {
  baseUrl: string
  csrfCookieName: string
  withCredentials: boolean
}

type ApiClientsConfig = {
  learn: LearnApiConfig
  mitxonline: MitxOnlineApiConfig
}

declare function configureApiClients(config: ApiClientsConfig): void
```

The exact type names can follow repo naming conventions, but the shape should remain explicit and backend-specific.

`frontends/main` is responsible for resolving which Learn base URL applies in the current runtime before calling `configureApiClients(...)`. This preserves the current behavior where server-side Learn requests may use a different URL than browser-side Learn requests, without pushing runtime-selection logic back into `frontends/api`.

`withCredentials` may remain a single env-derived setting in `main` initially, even though the runtime config shape is backend-specific.

### Export surface

The configuration API should be exported from a dedicated subpath such as `api/runtime`, rather than from the package root.

That keeps the current package-root behavior stable (`api` currently exports generated v1 symbols) and avoids mixing runtime/bootstrap concerns into the generated-client export surface.

### Singleton ownership

`frontends/api` will continue to own singleton instances for:

- the Learn axios instance
- the MITx Online axios instance
- generated client wrappers built on top of those axios instances

Existing hook modules can keep importing singleton clients from `clients.ts` and `mitxonline/clients.ts`. The important change is that those modules will derive their configuration from the runtime initializer rather than from `process.env`.

Exported singleton identities must remain stable. The implementation should mutate configuration on long-lived axios singletons and client wrappers, or use stable lazy access, rather than swapping exported objects after import.

As a boundary rule, `frontends/api` should continue to own thin data hooks around single-endpoint client calls. Composite hooks with app-shell side effects such as browser navigation should live in `frontends/main`.

### Base URL handling

Base URLs should be configured on the axios instances (`axios.defaults.baseURL`) rather than passed separately as env-derived `BASE_PATH` values throughout the workspace.

This matches the generated OpenAPI client behavior already present in the repo: both the local generated Learn clients and the external `@mitodl/mitxonline-api-axios` package skip prepending their own `basePath` when the axios instance has a `baseURL`.

As a result:

1. Generated client calls will use the configured axios instance.
2. Manual axios requests in `frontends/api` should use relative URLs derived from paginated `next` links or other absolute API URLs.
3. The workspace should not need to export runtime `BASE_PATH` values once custom callers are updated to relative paths.

For paginated `next` URLs specifically, the normalization rule should be explicit: when the API returns an absolute `next` URL, callers should discard the origin and use only `pathname + search`. That rule should be applied consistently at all three existing manual pagination sites (`learningResources`, `learningPaths`, and `userLists`) to preserve the current workaround for incorrect ports in absolute pagination URLs.

### MITx Online legacy cart redirect

`NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL` should not become part of the `frontends/api` runtime config.

Instead, `useReplaceBasketItem` should move from `frontends/api` into `frontends/main`. `frontends/api` should keep the thin data hooks and query helpers (`useAddToBasket`, `useClearBasket`, `basketQueries`), while `frontends/main` owns the orchestration that combines those hooks with browser navigation to the legacy cart URL.

To make that split real, `useAddToBasket` must stop performing redirect logic in its own `onSuccess`. It should become a pure data mutation hook, and the redirect to the legacy cart should be triggered by the `frontends/main` orchestration layer after a successful add-to-basket call.

This keeps `frontends/api` focused on API/client concerns and keeps env-derived app-shell navigation in the app layer where `env(...)` is available.

### Initialization semantics

Configuration must happen before any code path executes a request through the singleton clients.

The workspace must remain safe to import before configuration. Import-time evaluation should not fail. The first attempted request without configuration should fail loudly with a clear error rather than falling back silently. The failure should make it obvious that `configureApiClients(...)` must run first.

The configuration function should be synchronous, atomic, and idempotent for identical config. Reconfiguration with conflicting values should throw. Normal production flow should configure once per runtime; tests may need an explicit reset helper exposed from the runtime subpath.

Concrete bootstrap points in `frontends/main` should be treated as part of the design:

1. **Browser runtime:** call `configureApiClients(...)` from `frontends/main/src/instrumentation-client.ts`, which runs before React hydration on every page load.
2. **Server runtime:** call `configureApiClients(...)` during the `frontends/main/src/instrumentation.ts` → `instrumentation-node.ts` initialization path.

This is intentionally earlier than any provider `useEffect`. Configuring in a client effect would be too late because child components can execute React Query hooks during render and issue requests before the effect runs.

Outside those Next.js runtime hooks, any non-Next consumer that uses `frontends/api` hooks or clients (for example tests or Storybook) must bootstrap configuration explicitly through a shared helper path rather than assuming instrumentation files will run.

### Responsibility split

`frontends/main` responsibilities:

- read runtime env with `env(...)`
- normalize raw env values into typed config
- call `configureApiClients(...)` in each runtime before the first request path executes
- own app-shell side effects that need env-derived URLs outside the API client configuration itself

`frontends/api` responsibilities:

- validate that configuration has been provided before use
- apply config to axios singletons
- expose configured generated clients and hooks
- avoid all direct `process.env` access

## Data flow

1. A server runtime or browser runtime begins executing application code.
2. `frontends/main` reads runtime env through `env(...)`.
3. `frontends/main` resolves runtime-specific Learn configuration and shared MITx Online configuration.
4. `frontends/main` calls `configureApiClients(...)`.
5. `frontends/api` stores config in module state and configures its axios instances.
6. Existing hooks/query helpers use the already-configured singleton clients.
7. Any app-level orchestration that needs extra env-derived URLs stays in `frontends/main`.

## Error handling

The configuration layer should reject invalid or incomplete config explicitly.

Expected failure modes:

1. Missing required base URL.
2. Missing required CSRF cookie name.
3. Request attempted before configuration.
4. Conflicting reconfiguration attempt.

These should raise deterministic, developer-facing errors. The design should not silently default to empty strings or partially configured clients.

## Testing implications

Tests for `frontends/api` should configure the workspace explicitly in setup where needed, rather than relying on ambient env vars.

URL-building test helpers must derive their base URL from the same configured source as the axios instances, rather than from independent `process.env` reads. Otherwise request mocking can drift silently after env removal.

Important coverage areas:

1. `configureApiClients(...)` applies Learn and MITx Online config to the correct axios instances.
2. Learn config preserves current server-versus-browser URL behavior by passing the already-resolved runtime base URL into `frontends/api`.
3. Generated client calls use axios `baseURL` correctly for both Learn and MITx Online clients.
4. Manual request code works with relative URLs after `BASE_PATH` removal, including paginated absolute `next` links.
5. Using clients before configuration throws the intended error.
6. Identical repeated configure calls are safe, conflicting reconfigure throws, and test reset works as intended.
7. Existing URL-building test helpers continue to support request mocking after env removal.
8. Existing integration coverage still exercises the MITx Online add-to-cart redirect flow after the redirect logic moves to `frontends/main`.
9. Test and Storybook-style bootstrap paths configure the workspace explicitly when Next.js instrumentation hooks are not present.

## Alternatives considered

### Move `env(...)` into another workspace

Rejected because it spreads runtime-env concerns into shared packages rather than keeping them localized in `frontends/main`.

### Full dependency injection

Rejected for now because it would require broader refactoring of the current singleton client and hook structure. DI remains a valid future option if the repo later needs multiple client sets, request-scoped clients, or framework-agnostic composition.

### Keep exported normalized base paths in addition to axios `baseURL`

Not selected as the default design. If manual request code can be rewritten to relative URLs, keeping a separate exported base path would add redundant configuration state.

## Implementation notes for the next planning step

Likely touch points:

- `frontends/api/package.json`
- `frontends/api/src/axios.ts`
- `frontends/api/src/clients.ts`
- `frontends/api/src/mitxonline/clients.ts`
- direct manual request sites in:
  - `frontends/api/src/hooks/learningResources/queries.ts`
  - `frontends/api/src/hooks/learningPaths/queries.ts`
  - `frontends/api/src/hooks/userLists/queries.ts`
- remaining workspace env consumers:
  - `frontends/api/src/test-utils/urls.ts`
  - `frontends/api/src/mitxonline/test-utils/urls.ts`
- a dedicated runtime/config export in `frontends/api`
- bootstrap entry points in `frontends/main`
- MITx Online basket orchestration moved from `frontends/api/src/mitxonline/hooks/baskets/index.ts` into `frontends/main`
- current `useReplaceBasketItem` call sites in `frontends/main`:
  - `frontends/main/src/page-components/EnrollmentDialogs/ProgramEnrollmentDialog.tsx`
  - `frontends/main/src/page-components/EnrollmentDialogs/CourseEnrollmentDialog.tsx`
  - `frontends/main/src/app-pages/ProductPages/CourseEnrollmentButton.tsx`
  - `frontends/main/src/app-pages/ProductPages/ProgramEnrollmentButton.tsx`
  - `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/DashboardCard.tsx`
  - `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/ModuleCard.tsx`

The implementation plan should explicitly cover:

1. App Router bootstrap ordering so configuration runs before any request execution in both SSR and browser paths.
2. Moving `useReplaceBasketItem` into `frontends/main`, removing redirect logic from `useAddToBasket`, and updating the existing `frontends/main` call sites without adding a compatibility shim unless planning explicitly chooses one.
3. Keeping test URL builders and configured axios instances on a single shared source of truth.
4. Providing an explicit bootstrap path for tests and other non-Next consumers.
