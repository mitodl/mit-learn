import { cache } from "react"
import { QueryClient } from "@tanstack/react-query"
import { AxiosError } from "axios"

const MAX_RETRIES = 3
const NO_RETRY_CODES = [400, 401, 403, 404, 405, 409, 422]

export interface TaggedQueryClient extends QueryClient {
  __requestId?: string
  __createdAt?: number
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
const getServerQueryClient = cache(() => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
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
  }) as TaggedQueryClient

  queryClient.__requestId = Math.random().toString(36).substring(2, 12)
  queryClient.__createdAt = Date.now()

  return queryClient
})

export { getServerQueryClient }
