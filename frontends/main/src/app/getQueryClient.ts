// Based on https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr

import { QueryClient, isServer, focusManager } from "@tanstack/react-query"

type MaybeHasStatusAndDetail = {
  response?: {
    status?: number
    data?: {
      detail?: string
    }
  }
}

const MAX_RETRIES = 3
const THROW_ERROR_CODES = [400, 401, 403]
const NO_RETRY_CODES = [400, 401, 403, 404, 405, 409, 422]

const makeQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,

        /**
         * Throw runtime errors instead of marking query as errored.
         * The runtime error will be caught by an error boundary.
         * For now, only do this for 404s, 403s, and 401s. Other errors should
         * be handled locally by components.
         */
        throwOnError: (error) => {
          const status = (error as MaybeHasStatusAndDetail)?.response?.status
          return THROW_ERROR_CODES.includes(status ?? 0)
        },

        retry: (failureCount, error) => {
          const status = (error as MaybeHasStatusAndDetail)?.response?.status
          const isNetworkError = status === undefined || status === 0

          /**
           * React Query's default behavior is to retry all failed queries 3
           * times. Many things (e.g. 403, 404) are not worth retrying. Let's
           * exclude these.
           *
           * Includes statuses undefined and 0 as we want to retry on network errors.
           */
          if (isNetworkError || !NO_RETRY_CODES.includes(status)) {
            return failureCount < MAX_RETRIES
          }
          return false
        },

        /**
         * By default, React Query gradually applies a backoff delay, though it is
         * preferable that we do not significantly delay initial page renders on
         * the server and instead allow the request to fail quickly so it can be
         * subsequently fetched on the client. Note that we aim to prefetch any API
         * content needed to render the page, so we don't generally expect the retry
         * rules above to be in use on the server.
         */
        retryDelay: isServer ? 1000 : undefined,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
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

export { makeQueryClient, getQueryClient }
export type { MaybeHasStatusAndDetail }
