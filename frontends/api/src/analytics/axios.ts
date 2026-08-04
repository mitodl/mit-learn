import { createConfigurableAxios } from "../configurableAxios"

/**
 * Axios instance for the OL Analytics API (`ol-analytics-api`).
 *
 * Auth is entirely cookie-based: the analytics API sits behind APISIX, which
 * resolves the session cookie into the JWT the API expects. The browser sends
 * the cookie because of `withCredentials`, so nothing here attaches a token.
 */
export const analyticsAxiosClient = createConfigurableAxios(
  "mit-learn.api.axios.analytics",
)

export default analyticsAxiosClient.instance
