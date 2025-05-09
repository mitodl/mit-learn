import { QueryClient, dehydrate } from "@tanstack/react-query"
import type { Query } from "@tanstack/react-query"

/* Utility to avoid repetition in server components
 * Optionally pass the queryClient returned from a previous prefetch
 * where queries are dependent on previous results
 */
export const prefetch = async (
  queries: (Query | unknown)[],
  queryClient?: QueryClient,
) => {
  queryClient = queryClient || new QueryClient()

  await Promise.all(
    queries
      .filter(Boolean)
      .map((query) => queryClient.prefetchQuery(query as Query)),
  )

  return { dehydratedState: dehydrate(queryClient), queryClient }
}
