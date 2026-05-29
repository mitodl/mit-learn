import invariant from "tiny-invariant"
import { configureApiClients, isApiClientsConfigured } from "api/runtime"

const isServerRuntime = () => typeof window === "undefined"

// `value` must be passed as a static `process.env.NEXT_PUBLIC_*` reference, not
// a dynamic `process.env[name]` lookup: Next inlines client-side env vars via
// literal text substitution at build time, so dynamic access yields undefined
// in the browser even when the var is set.
const requireEnv = (name: string, value: string | undefined): string => {
  invariant(value, `${name} is not set`)
  return value
}

export const bootstrapApiClients = () => {
  // First-wins: the server calls this once at startup from instrumentation.ts;
  // the browser calls it once from instrumentation-client.ts, which can re-enter
  // under Fast Refresh. The repeat call is the same intent as the first, so
  // no-op rather than throw.
  if (isApiClientsConfigured()) return

  // NEXT_SERVER_MITOL_API_BASE_URL points the server at an internal host for
  // split-host local-dev/docker. An explicitly blank value (as in
  // env/codespaces.env) means "no separate server host" — fall back to the
  // public URL. Use `||` rather than `??` so the empty string triggers the
  // fallback instead of being treated as a configured base URL.
  const serverLearnBaseUrl = isServerRuntime()
    ? process.env.NEXT_SERVER_MITOL_API_BASE_URL
    : undefined
  const learnBaseUrl =
    serverLearnBaseUrl ||
    requireEnv(
      "NEXT_PUBLIC_MITOL_API_BASE_URL",
      process.env.NEXT_PUBLIC_MITOL_API_BASE_URL,
    )

  const withCredentials =
    process.env.NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS === "true"

  configureApiClients({
    learn: {
      baseUrl: learnBaseUrl,
      csrfCookieName: requireEnv(
        "NEXT_PUBLIC_CSRF_COOKIE_NAME",
        process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME,
      ),
      withCredentials,
    },
    mitxonline: {
      baseUrl: requireEnv(
        "NEXT_PUBLIC_MITX_ONLINE_BASE_URL",
        process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL,
      ),
      csrfCookieName: requireEnv(
        "NEXT_PUBLIC_MITX_ONLINE_CSRF_COOKIE_NAME",
        process.env.NEXT_PUBLIC_MITX_ONLINE_CSRF_COOKIE_NAME,
      ),
      withCredentials,
    },
  })
}
