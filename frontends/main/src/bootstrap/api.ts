import invariant from "tiny-invariant"
import { configureApiClients, isApiClientsConfigured } from "api/runtime"

const isServerRuntime = () => typeof window === "undefined"

const requireEnv = (name: string): string => {
  const value = process.env[name]
  invariant(value, `${name} is not set`)
  return value
}

export const bootstrapApiClients = () => {
  // First-wins: the server calls this once at startup from instrumentation.ts;
  // the browser calls it once from instrumentation-client.ts, which can re-enter
  // under Fast Refresh. The repeat call is the same intent as the first, so
  // no-op rather than throw.
  if (isApiClientsConfigured()) return

  const learnBaseUrl =
    (isServerRuntime()
      ? process.env.NEXT_SERVER_MITOL_API_BASE_URL
      : undefined) ?? requireEnv("NEXT_PUBLIC_MITOL_API_BASE_URL")

  const withCredentials =
    process.env.NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS === "true"

  configureApiClients({
    learn: {
      baseUrl: learnBaseUrl,
      csrfCookieName: requireEnv("NEXT_PUBLIC_CSRF_COOKIE_NAME"),
      withCredentials,
    },
    mitxonline: {
      baseUrl: requireEnv("NEXT_PUBLIC_MITX_ONLINE_BASE_URL"),
      csrfCookieName: requireEnv("NEXT_PUBLIC_MITX_ONLINE_CSRF_COOKIE_NAME"),
      withCredentials,
    },
  })
}
