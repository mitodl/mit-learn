import { configureApiClients } from "api/runtime"

const isServerRuntime = () => typeof window === "undefined"

export const bootstrapApiClients = () => {
  const learnBaseUrl =
    isServerRuntime() && process.env.NEXT_SERVER_MITOL_API_BASE_URL
      ? process.env.NEXT_SERVER_MITOL_API_BASE_URL
      : process.env.NEXT_PUBLIC_MITOL_API_BASE_URL

  configureApiClients({
    learn: {
      baseUrl: learnBaseUrl!,
      csrfCookieName: process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME!,
      withCredentials:
        process.env.NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS === "true",
    },
    mitxonline: {
      baseUrl: process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL!,
      csrfCookieName: process.env.NEXT_PUBLIC_MITX_ONLINE_CSRF_COOKIE_NAME!,
      withCredentials:
        process.env.NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS === "true",
    },
  })
}
