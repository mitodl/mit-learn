import { NewBrowserContextOptions } from "k6/browser"

export const BACKEND_BASE_URL: string = __ENV.BACKEND_BASE_URL
export const FRONTEND_BASE_URL: string = __ENV.FRONTEND_BASE_URL

export const IGNORE_HTTPS_ERRORS: boolean =
  (__ENV.IGNORE_HTTPS_ERRORS || "false").toLowerCase() == "true"

export const BROWSER_CONTEXT_OPTIONS: NewBrowserContextOptions = {
  ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS,
}
