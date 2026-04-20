import { NewBrowserContextOptions } from "k6/browser"

export const BACKEND_BASE_URL: string = __ENV.BACKEND_BASE_URL
export const FRONTEND_BASE_URL: string = __ENV.FRONTEND_BASE_URL

export const BROWSER_CONTEXT_OPTIONS: NewBrowserContextOptions = {
  ignoreHTTPSErrors: Object.hasOwn(__ENV, "BROWSER_IGNORE_HTTPS_ERRORS")
    ? __ENV.BROWSER_IGNORE_HTTPS_ERRORS
    : false,
}
