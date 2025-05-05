import { QueryClient, dehydrate } from "@tanstack/react-query"
import type { Query } from "@tanstack/react-query"

const MAX_RETRIES = 3
const NO_RETRY_CODES: (number | undefined)[] = [404, 403, 401]

type MaybeHasStatus = {
  response?: {
    status?: number
  }
  config?: {
    url?: string
  }
}

/* Utility to avoid repetition in server components
 * Optionally pass the queryClient returned from a previous prefetch
 * where queries are dependent on previous results
 */
export const prefetch = async (
  queries: (Query | unknown)[],
  queryClient?: QueryClient,
) => {
  queryClient =
    queryClient ||
    new QueryClient({
      defaultOptions: {
        queries: {
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
              isBrowser ? "client" : "server",
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

  await Promise.all(
    queries
      .filter(Boolean)
      .map((query) => queryClient.prefetchQuery(query as Query)),
  )

  return { dehydratedState: dehydrate(queryClient), queryClient }
}
