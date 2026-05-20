import invariant from "tiny-invariant"

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

export const env = (key: `NEXT_PUBLIC_${string}`): string | undefined => {
  if (typeof window !== "undefined") {
    // Browser: read from server-injected window.__ENV; fall back to
    // process.env (which webpack polyfills — safe in webpack bundles, and
    // allows test environments that set process.env directly to work).
    return window.__ENV?.[key] ?? process.env[key]
  }
  // Server: dynamic bracket access is NOT replaced by DefinePlugin, so this
  // reads the actual Kubernetes env var at request time.
  return process.env[key]
}

export const requiredEnv = (key: `NEXT_PUBLIC_${string}`): string => {
  const value = env(key)
  invariant(value, `${key} must be defined`)
  return value
}
