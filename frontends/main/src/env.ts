import invariant from "tiny-invariant"
import type { InferType } from "yup"

/**
 * Runtime environment variable accessor for NEXT_PUBLIC_* vars.
 *
 * Problem: webpack's DefinePlugin inlines `process.env.NEXT_PUBLIC_FOO` at
 * *build* time. When the Docker image is built in CI without per-environment
 * values, every NEXT_PUBLIC_* reference in the compiled bundle becomes an
 * empty string, even though the Kubernetes pod has the correct values set.
 *
 * Solution: `PublicEnvScript` (a Server Component in app/layout.tsx) renders
 * a synchronous inline <script> that sets `window.__ENV = { NEXT_PUBLIC_*:
 * <runtime value> }` before any JS bundle loads. This function reads from
 * that object in the browser and from process.env (dynamic bracket access,
 * not inlined by DefinePlugin) on the server.
 *
 * Test compatibility: jsdom sets `window` but not `window.__ENV`. The
 * `?? process.env[key]` fallback lets existing tests that mutate
 * `process.env.NEXT_PUBLIC_*` directly continue to work with no changes.
 */
declare global {
  interface Window {
    __ENV?: Record<string, string | undefined>
  }
}

/**
 * Key unions derived from the single source of truth — the yup schema in
 * validateEnv.js (imported as a type only, so no runtime/bundle cost).
 *
 * - `PublicEnvVar`: every NEXT_PUBLIC_* key the schema declares (required or
 *   optional). Adding a new NEXT_PUBLIC_* var the app reads means adding it to
 *   the schema; otherwise env()/requiredEnv() reject it at compile time.
 * - `RequiredPublicEnvVar`: the subset marked `.required()` in the schema —
 *   guaranteed present at runtime by validateEnv() at server startup.
 */
type EnvSchema = InferType<typeof import("../validateEnv").schema>
type RequiredKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]
type PublicEnvVar = Extract<keyof EnvSchema, `NEXT_PUBLIC_${string}`>
type RequiredPublicEnvVar = Extract<
  RequiredKeys<EnvSchema>,
  `NEXT_PUBLIC_${string}`
>

/**
 * Get the value of an environment variable at runtime.
 * NOTES:
 *  - Only NEXT_PUBLIC_ env vars are accessible this way. If you need a server-only
 *    environment variable, read from process.env
 *  - Env vars will always be undefined at build time.
 */
export const env = (key: PublicEnvVar): string | undefined => {
  if (typeof window !== "undefined") {
    // Browser: read from server-injected window.__ENV. Fall back to process.env
    // only when a `process` global actually exists (jsdom/test environments that
    // set process.env directly). Webpack provides no `process` global for
    // dynamic `process.env[key]` access, so an unguarded read would throw
    // `ReferenceError: process is not defined` for any key absent from __ENV
    // (e.g. an optional NEXT_PUBLIC_* var unset in the pod).
    return (
      window.__ENV?.[key] ??
      (typeof process !== "undefined" ? process.env[key] : undefined)
    )
  }
  // Server: dynamic bracket access is NOT replaced by DefinePlugin, so this
  // reads the actual Kubernetes env var at request time.
  return process.env[key]
}

/**
 * Get the value of a required environment variable at runtime.
 * NOTES:
 *  - presence of required runtime variables is validated at startup
 *  - This function cannot be used at module scope because env vars are not set
 *    at build time.
 */
export const requiredEnv = (key: RequiredPublicEnvVar): string => {
  const value = env(key)
  invariant(value, `${key} must be defined`)
  return value
}
