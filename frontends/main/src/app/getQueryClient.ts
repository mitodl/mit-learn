// Based on https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr

import { QueryClient, isServer, focusManager } from "@tanstack/react-query"
import type { AxiosError } from "axios"
import { cache } from "react"
import { notFound } from "next/navigation"

const MAX_RETRIES = 3
const THROW_ERROR_CODES = [400, 401, 403]
const NO_RETRY_CODES = [400, 401, 403, 404, 405, 409, 422]

/**
 * Extended QueryClient with custom fetchQueryOr404 method.
 * Automatically calls notFound() on 404 errors when running on the server.
 */
class AugmentedQueryClient extends QueryClient {
  /**
   * Fetch and automatically call notFound() on 404 errors.
   * Uses fetchQuery internally, which throws on error and populates the cache.
   *
   * This should be used wherever we are fetching critical data that must exist for the page to render.
   *
   * Note: notFound() is only called on the server. In the browser, 404 errors are thrown normally.
   */
  fetchQueryOr404: QueryClient["fetchQuery"] = async (...args) => {
    try {
      return await super.fetchQuery(...args)
    } catch (error: unknown) {
      /* If the response is a 404, call notFound() to return proper 404 status
       * This ensures the base page response is a 404, not a 200 with a not found message.
       *
       * Only call notFound() on the server - it's designed for server-side rendering.
       * In the browser, we throw the error normally so it can be handled by error boundaries.
       */
      const axiosError = error as AxiosError
      if (isServer && axiosError?.response?.status === 404) {
        notFound()
      }

      throw error
    }
  }
}

/**
 * Get or create a server-side QueryClient for consistent retry behavior.
 * The server QueryClient should be used for all server-side API calls.
 *
 * Uses React's cache() to ensure the same QueryClient instance is reused
 * throughout a single HTTP request, enabling:
 *
 * - Server API calls share the same QueryClient:
 *   - Prefetch runs in page server components
 *   - generateMetadata()
 * - No duplicate API calls within the same request
 * - Automatic cleanup when the request completes
 * - Isolation between different HTTP requests
 *
 * The QueryClientProvider runs (during SSR) in a separate render pass as it's a
 * client component and so the instance is not reused. On the server this does not
 * make API calls and only sets up the hydration boundary and registers hooks in
 * readiness for the dehydrated state to be sent to the client.
 */
export const getServerQueryClient = cache(() => {
  return new AugmentedQueryClient({
    defaultOptions: {
      queries: {
        /**
         * We create a new query client per request, but still need a staleTime
         * to avoid marking queries as stale during the server-side render pass.
         * That can cause hydration errors if client renders differently when
         * the requests are stale (e.g., dependence on isFetching)
         *
         * The exact value here isn't important, as long as it's bigger than
         * request duration.
         */
        staleTime: 15 * 60 * 1000,

        /**
         * React Query's default retry logic is only active in the browser.
         * Here we explicitly configure it to retry MAX_RETRIES times on
         * the server, with an exclusion list of statuses that we expect not
         * to succeed on retry.
         *
         * Includes status undefined as we want to retry on network errors
         */
        retry: (failureCount, error) => {
          const axiosError = error as AxiosError
          console.info("Retrying failed request", {
            failureCount,
            error: {
              message: axiosError.message,
              name: axiosError.name,
              status: axiosError?.status,
              code: axiosError.code,
              method: axiosError.request?.method,
              url: axiosError.request?.url,
            },
          })
          const status = (error as AxiosError)?.response?.status
          const isNetworkError = status === undefined || status === 0

          if (isNetworkError || !NO_RETRY_CODES.includes(status)) {
            return failureCount < MAX_RETRIES
          }
          return false
        },

        /**
         * By default, React Query gradually applies a backoff delay, though it is
         * preferable that we do not significantly delay initial page renders (or
         * indeed pages that are Statically Rendered during the build process) and
         * instead allow the request to fail quickly so it can be subsequently
         * fetched on the client.
         */
        retryDelay: 1000,
      },
    },
  })
})

type BrowserClientConfig = {
  maxRetries: number
}
const DEFAULT_BROWSER_CLIENT_CONFIG: BrowserClientConfig = {
  maxRetries: MAX_RETRIES,
}
const makeBrowserQueryClient = (
  config: BrowserClientConfig = DEFAULT_BROWSER_CLIENT_CONFIG,
): AugmentedQueryClient => {
  const { maxRetries } = config
  return new AugmentedQueryClient({
    defaultOptions: {
      queries: {
        /**
         * Public API content is server-rendered to the base page and cached by the CDN.
         * Keep staleTime >= CDN TTL so hydrated queries are not immediately refetched.
         * The CDN TTL is specified by the s-max-age value in the Cache-Control header
         * in next.config.js.
         *
         * Most content is stable for ~24 hours (ETL cadence), but if staleTime is shorter
         * than the CDN TTL, React Query will refetch on hydration once the cached HTML
         * is older than staleTime.
         *
         * This can cause visible content flicker for unstable endpoints (e.g. the
         * featured learning resource list, which is intentionally randomized).
         */
        staleTime: 30 * 60 * 1000,

        /**
         * Throw runtime errors instead of marking query as errored.
         * The runtime error will be caught by an error boundary.
         * For now, only do this for 404s, 403s, and 401s. Other errors should
         * be handled locally by components.
         */
        throwOnError: (error) => {
          const status = (error as AxiosError)?.response?.status
          return THROW_ERROR_CODES.includes(status ?? 0)
        },

        retry: (failureCount, error) => {
          const status = (error as AxiosError)?.response?.status
          const isNetworkError = status === undefined || status === 0

          /**
           * React Query's default behavior is to retry all failed queries 3
           * times. Many things (e.g. 403, 404) are not worth retrying. Let's
           * exclude these.
           *
           * Includes statuses undefined and 0 as we want to retry on network errors.
           */
          if (isNetworkError || !NO_RETRY_CODES.includes(status)) {
            return failureCount < maxRetries
          }
          return false
        },
      },
    },
  })
}

let browserQueryClient: AugmentedQueryClient | undefined = undefined

function getQueryClient(): AugmentedQueryClient {
  if (isServer) {
    return getServerQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) {
      browserQueryClient = makeBrowserQueryClient()
      initBrowserDevTools(browserQueryClient)
    }

    return browserQueryClient
  }
}

declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__?: QueryClient
  }
}
/**
 * Initialize Tanstack Query browser dev tools.
 *
 * - This can be enabled in production, it only affects people with the extension installed.
 * - See https://tanstack.com/query/v5/docs/framework/react/devtools
 */
function initBrowserDevTools(browserQueryClient: QueryClient) {
  if (process.env.NODE_ENV === "development") {
    // Log a tip about using Tanstack Query devtools
    // But only once... We don't want to spam devs on every hot reload
    if (!window.__TANSTACK_QUERY_CLIENT__) {
      const parts = [
        {
          text: "API Query Debugging\n",
          style: "color: blue; font-weight: bold;",
        },
        {
          text: "Tip: You can use Tanstack Query devtools to inspect query data, even if the data was fetched server-side. See https://tanstack.com/query/v5/docs/framework/react/devtools",
          style: "color: unset; font-weight: normal;",
        },
      ]
      console.log(
        parts.map(({ text }) => `%c${text}`).join(""),
        ...parts.map(({ style }) => style),
      )
    }
  }
  window.__TANSTACK_QUERY_CLIENT__ = browserQueryClient
}

/**
 * Use a custom focus manager for react-query's refetchOnWindowFocus feature.
 *
 * NOTES:
 *  - Despite its name, refetchOnWindowFocus doesn't map 1-to-1 to browser focus
 *  - The default handlers only use visibilitychange. This triggers refetch when
 *    switching between tabs in the same window or minimizing/restoring the
 *    browser window, but NOT when switching between windows
 *  - Our implementation refetches on both visibilitychange and focus events:
 *      - focus handles switching between windows and, usually, tabs.
 *        (Usually = as long as the site is focused, and not, say, the URL bar,
 *         devtools, or other browser UI.)
 *      - visibilitychange handles minimizing/restoring the browser window and
 *        switching between tabs in the same window.
 *
 * Refetching on focus has some minor disadvantages. Chiefly:
 *  - It refetches when focusing between main site and browser UI (devtools,
 *    URL bar, etc.)
 *
 * See https://github.com/TanStack/query/discussions/6568 for discussion
 *
 */
focusManager.setEventListener((setFocused) => {
  const setFocusAndLogChange = (focused?: boolean) => {
    if (focused && !focusManager.isFocused()) {
      console.log(
        "Site refocus detected; React Query will refetch stale queries.",
      )
    }
    setFocused(focused)
  }
  const handleFocusChange = () => {
    setFocusAndLogChange(document.hasFocus())
  }
  const handleVisibilityChange = () => {
    setFocusAndLogChange(document.visibilityState === "visible")
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("visibilitychange", handleVisibilityChange, false)
    window.addEventListener("focus", handleFocusChange, false)
    window.addEventListener("blur", handleFocusChange, false)

    return () => {
      // Be sure to unsubscribe if a new handler is set
      window.removeEventListener("focus", handleFocusChange)
      window.removeEventListener("blur", handleFocusChange)
      window.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }
})

export { makeBrowserQueryClient, getQueryClient }
