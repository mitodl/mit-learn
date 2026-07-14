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
 * Solution: the server delivers all NEXT_PUBLIC_* values as JSON in an
 * <meta name="x-public-env"> tag (PublicEnvInsertedHtml, injected via
 * useServerInsertedHTML so it reaches the <head> of error-shell responses
 * too). In the browser this function reads that tag (cached on window.__ENV);
 * on the server it reads process.env (dynamic bracket access, not inlined by
 * DefinePlugin).
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

// Populate window.__ENV on first read. Tiers:
//   1. window.__ENV — cache of a previous successful read.
//   2. The x-public-env <meta>. Two copies exist: PublicEnvInsertedHtml's
//      (early in <head> on normal AND error-shell responses — the copy that
//      matters) and the root layout metadata's (streams near the END of the
//      body on error shells; the surviving copy when the root layout itself
//      errors and Providers never renders). Either is only visible once the
//      parser has reached it.
//   3. Synchronous fetch of /public-env.json — module evaluation (e.g.
//      instrumentation-client.ts, module-scope env() captures) can run while
//      the document is still streaming, before any <meta> has been parsed. A
//      blocking XHR is the only way to resolve values synchronously at that
//      point; it fires at most once, and only when the document is still
//      parsing with no <meta> available — in practice only when the head copy
//      is missing entirely (global-error).
// Shared by env() and fullEnv().
let publicEnvFetchAttempted = false
const bootstrapClientEnv = (): void => {
  if (window.__ENV) return
  const content = document
    .querySelector('meta[name="x-public-env"]')
    ?.getAttribute("content")
  if (content) {
    try {
      window.__ENV = JSON.parse(content)
    } catch {
      /* malformed; leave unset and fall through to process.env */
    }
    return
  }
  if (document.readyState === "loading" && !publicEnvFetchAttempted) {
    publicEnvFetchAttempted = true
    try {
      const xhr = new XMLHttpRequest()
      xhr.open("GET", "/public-env.json", false)
      xhr.send()
      if (xhr.status === 200) {
        window.__ENV = JSON.parse(xhr.responseText)
      }
    } catch {
      /* leave unset; the <meta> (tier 2) can still succeed on a later read */
    }
  }
}

/**
 * Get the value of an environment variable at runtime.
 * NOTES:
 *  - Only NEXT_PUBLIC_ env vars are accessible this way. If you need a server-only
 *    environment variable, read from process.env
 *  - Env vars will always be undefined at build time.
 */
export const env = (key: PublicEnvVar): string | undefined => {
  if (typeof window !== "undefined") {
    bootstrapClientEnv()
    // Fall back to process.env only when a `process` global exists (jsdom/test
    // environments that set it directly). Webpack provides no `process` global,
    // so an unguarded read would throw ReferenceError for any key absent from
    // __ENV (e.g. an optional NEXT_PUBLIC_* var unset in the pod).
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
 * The full { NEXT_PUBLIC_*: value } map (vs env()'s single key). Uses the same
 * client bootstrap as env() — window.__ENV, populated from the x-public-env
 * <meta> if needed; on the server reads process.env.
 */
export const fullEnv = (): Record<string, string | undefined> => {
  if (typeof window !== "undefined") {
    bootstrapClientEnv()
    return window.__ENV ?? {}
  }
  return publicEnvObject()
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

/**
 * Server-side { NEXT_PUBLIC_*: value } map from process.env. Shared by
 * the x-public-env <meta> emitters and /public-env.json so they can't drift.
 */
export const publicEnvObject = (): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(process.env).filter(([k]) => k.startsWith("NEXT_PUBLIC_")),
  )
