// Based on https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr

import { QueryClient, isServer } from "@tanstack/react-query"

type MaybeHasStatus = {
  response?: {
    status?: number
  }
  config?: {
    url?: string
  }
}

// const RETRY_STATUS_CODES = [408, 429, 502, 503, 504]
const MAX_RETRIES = 3
const NO_RETRY_CODES: (number | undefined)[] = [404, 403, 401]

console.log("TEST LOG?")

const makeQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: Infinity,
        // Throw runtime errors instead of marking query as errored.
        // The runtime error will be caught by an error boundary.
        // For now, only do this for 404s, 403s, and 401s. Other errors should
        // be handled locally by components.
        throwOnError: (error) => {
          console.log("Full error", error)
          const status = (error as MaybeHasStatus)?.response?.status
          const isNetworkError = status === undefined || status === 0
          const id = (error as MaybeHasStatus)?.config?.url
          const isBrowser = typeof window !== "undefined"
          const isOffline =
            isBrowser && typeof navigator !== "undefined" && !navigator.onLine
          console.log(
            "throwOnError",
            isServer ? "server" : "client",
            status,
            id,
            "network error:",
            isNetworkError,
            "id in browser:",
            isBrowser ? id : undefined,
            "offline:",
            isOffline,
          )
          return NO_RETRY_CODES.includes(status)
        },
        retry: (failureCount, error) => {
          const status = (error as MaybeHasStatus)?.response?.status
          const isNetworkError = status === undefined || status === 0
          const id = (error as MaybeHasStatus)?.config?.url
          const isBrowser = typeof window !== "undefined"
          const isOffline =
            isBrowser && typeof navigator !== "undefined" && !navigator.onLine
          console.log(
            "retry",
            failureCount,
            isServer ? "server" : "client",
            status,
            id,
            "network error:",
            isNetworkError,
            "id in browser:",
            isBrowser ? id : undefined,
            "offline:",
            isOffline,
          )
          /**
           * React Query's default behavior is to retry all failed queries 3
           * times. Many things (e.g., 403, 404) are not worth retrying. Let's
           * just retry some explicit whitelist of status codes.
           *
           * Includes status undefined as we want to retry on network errors
           */
          if (status === undefined || !NO_RETRY_CODES.includes(status)) {
            return failureCount < MAX_RETRIES
          }
          return false
        },
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

export { makeQueryClient, getQueryClient }
