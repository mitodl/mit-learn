import { QueryClient, dehydrate } from "@tanstack/react-query"
import type { Query } from "@tanstack/react-query"

const MAX_RETRIES = 3
const NO_RETRY_CODES = [400, 401, 403, 404, 405, 409, 422]

type MaybeHasStatus = {
  response?: {
    status?: number
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
  /**
   * The SSR QueryClient is transient - it is created only for prefetch
   * while API requests are made to server render the page and discarded
   * as the dehydrated state is produced and sent to the client.
   *
   * Create a new query client if one is not provided.
   */
  queryClient =
    queryClient ||
    new QueryClient({
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
            const status = (error as MaybeHasStatus)?.response?.status
            const isNetworkError = status === undefined || status === 0

            if (isNetworkError || !NO_RETRY_CODES.includes(status)) {
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
