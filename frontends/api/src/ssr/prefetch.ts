import { dehydrate } from "@tanstack/react-query"
import { getServerQueryClient } from "./serverQueryClient"
import type { Query } from "@tanstack/react-query"

/**
 * Utility to avoid repetition in server components
 * Optionally pass the queryClient returned from a previous prefetch
 * where queries are dependent on previous results
 */
export const prefetch = async (
  queries: (Query | unknown)[],

  /**
   * Unless passed, the SSR QueryClient uses React's cache() for reuse for the duration of the request.
   *
   * The QueryClient is garbage collected once the dehydrated state is produced and
   * sent to the client and the request is complete.
   */
  queryClient = getServerQueryClient(),
) => {
  await Promise.all(
    queries.filter(Boolean).map((query) => {
      return queryClient.prefetchQuery(query as Query)
    }),
  )

  return {
    dehydratedState: dehydrate(queryClient),
    queryClient,
  }
}
