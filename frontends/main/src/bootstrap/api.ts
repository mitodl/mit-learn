import invariant from "tiny-invariant"
import { configureApiClients, isApiClientsConfigured } from "api/runtime"

const isServerRuntime = () => typeof window === "undefined"

const requireEnv = (name: string): string => {
  const value = process.env[name]
  invariant(value, `${name} is not set`)
  return value
}

export const bootstrapApiClients = () => {
  // First-wins: the server process calls this once from instrumentation and may
  // re-enter via the SSR pass through providers.tsx; the browser calls this
  // once from instrumentation-client.ts and may re-enter under Fast Refresh.
  // In every case the second call is the same intent as the first, so no-op.
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
