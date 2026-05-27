# API workspace runtime client configuration

## Status

Approved for implementation planning on 2026-05-27.

## Problem

`frontends/api` currently reads `process.env` directly in module scope from:

- `frontends/api/src/axios.ts`
- `frontends/api/src/clients.ts`
- `frontends/api/src/mitxonline/clients.ts`

That conflicts with the runtime-env direction in `tmacey/nextjs-deployment-simplification`, where `frontends/main` should be the layer that reads environment variables through `env(...)` at runtime. Shared workspaces should not depend on build-time or runtime environment globals.

## Goals

1. Remove `process.env` reads from `frontends/api`.
2. Keep the current singleton-style API exports and existing hook usage patterns.
3. Make configuration easy for `frontends/main` to provide from `env(...)`.
4. Preserve support for both Learn API and MITx Online API configuration.
5. Keep manual axios requests and generated client requests aligned on the same runtime configuration.

## Non-goals

1. Introduce full dependency injection across query helpers and hooks.
2. Redesign the `frontends/api` public hook surface.
3. Move the `env(...)` helper into another workspace.

## Decision

Use a **one-time singleton configuration step** inside `frontends/api`.

`frontends/main` will read runtime env values with `env(...)` and pass a typed configuration object into `frontends/api` during app startup. `frontends/api` will use that configuration to set up its singleton axios instances and generated API clients. The workspace itself will no longer read `process.env`.

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

### Singleton ownership

`frontends/api` will continue to own singleton instances for:

- the Learn axios instance
- the MITx Online axios instance
- generated client wrappers built on top of those axios instances

Existing hook modules can keep importing singleton clients from `clients.ts` and `mitxonline/clients.ts`. The important change is that those modules will derive their configuration from the runtime initializer rather than from `process.env`.

### Base URL handling

Base URLs should be configured on the axios instances (`axios.defaults.baseURL`) rather than passed separately as env-derived `BASE_PATH` values throughout the workspace.

This matches the generated OpenAPI client behavior already present in the repo: when the axios instance has a `baseURL`, generated request functions do not prepend their own `basePath`.

As a result:

1. Generated client calls will use the configured axios instance.
2. Manual axios requests in `frontends/api` should use relative URLs.
3. The workspace should not need to export runtime `BASE_PATH` values once custom callers are updated to relative paths.

### Initialization semantics

Configuration must happen before any code path executes a request through the singleton clients.

If the workspace is used before configuration, it should fail loudly with a clear error rather than falling back silently. The failure should make it obvious that `configureApiClients(...)` must run first.

The configuration function should be safe to call exactly once during normal app startup. Reconfiguration should not be part of the normal production flow.

### Responsibility split

`frontends/main` responsibilities:

- read runtime env with `env(...)`
- normalize raw env values into typed config
- call `configureApiClients(...)` during startup

`frontends/api` responsibilities:

- validate that configuration has been provided before use
- apply config to axios singletons
- expose configured generated clients and hooks
- avoid all direct `process.env` access

## Data flow

1. `frontends/main` starts.
2. `frontends/main` reads runtime env through `env(...)`.
3. `frontends/main` calls `configureApiClients(...)`.
4. `frontends/api` stores config in module state and configures its axios instances.
5. Existing hooks/query helpers use the already-configured singleton clients.

## Error handling

The configuration layer should reject invalid or incomplete config explicitly.

Expected failure modes:

1. Missing required base URL.
2. Missing required CSRF cookie name.
3. Request attempted before configuration.

These should raise deterministic, developer-facing errors. The design should not silently default to empty strings or partially configured clients.

## Testing implications

Tests for `frontends/api` should configure the workspace explicitly in setup where needed, rather than relying on ambient env vars.

Important coverage areas:

1. `configureApiClients(...)` applies Learn and MITx Online config to the correct axios instances.
2. Generated client calls use axios `baseURL` correctly.
3. Manual request code works with relative URLs after `BASE_PATH` removal.
4. Using clients before configuration throws the intended error.

## Alternatives considered

### Move `env(...)` into another workspace

Rejected because it spreads runtime-env concerns into shared packages rather than keeping them localized in `frontends/main`.

### Full dependency injection

Rejected for now because it would require broader refactoring of the current singleton client and hook structure. DI remains a valid future option if the repo later needs multiple client sets, request-scoped clients, or framework-agnostic composition.

### Keep exported normalized base paths in addition to axios `baseURL`

Not selected as the default design. If manual request code can be rewritten to relative URLs, keeping a separate exported base path would add redundant configuration state.

## Implementation notes for the next planning step

Likely touch points:

- `frontends/api/src/axios.ts`
- `frontends/api/src/clients.ts`
- `frontends/api/src/mitxonline/clients.ts`
- direct manual request sites in `frontends/api/src/hooks/**`
- a startup/config entry point in `frontends/main`

The implementation plan should explicitly cover startup ordering so configuration runs before any client usage.
