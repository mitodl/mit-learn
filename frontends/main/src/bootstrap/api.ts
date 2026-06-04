import { env, requiredEnv } from "@/env"
import { configureApiClients, isApiClientsConfigured } from "api/runtime"

export const bootstrapApiClients = () => {
  // First-wins: the server calls this once at startup from instrumentation.ts;
  // the browser calls it once from instrumentation-client.ts, which can re-enter
  // under Fast Refresh. The repeat call is the same intent as the first, so
  // no-op rather than throw.
  if (isApiClientsConfigured()) return

  // NEXT_PUBLIC_* values are read via env()/requiredEnv() (src/env.ts) so they
  // come from the runtime environment — window.__ENV in the browser, process.env
  // on the server — rather than being inlined at build time. This is what lets
  // the standalone Docker image be built once and configured per-environment by
  // Kubernetes. bootstrapApiClients() only runs at request/startup time (never
  // during `next build`), so requiredEnv()'s invariant is safe here.

  const learnBaseUrl = requiredEnv("NEXT_PUBLIC_MITOL_API_BASE_URL")

  const withCredentials =
    env("NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS") === "true"

  configureApiClients({
    learn: {
      baseUrl: learnBaseUrl,
      csrfCookieName: requiredEnv("NEXT_PUBLIC_CSRF_COOKIE_NAME"),
      withCredentials,
    },
    mitxonline: {
      baseUrl: requiredEnv("NEXT_PUBLIC_MITX_ONLINE_BASE_URL"),
      csrfCookieName: requiredEnv("NEXT_PUBLIC_MITX_ONLINE_CSRF_COOKIE_NAME"),
      withCredentials,
    },
  })
}
