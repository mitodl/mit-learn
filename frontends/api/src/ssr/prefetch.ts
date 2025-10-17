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
  try {
    await Promise.all(
      queries.filter(Boolean).map(async (query) => {
        try {
          return await queryClient.prefetchQuery(query as Query)
        } catch (error) {
          console.error(
            "Prefetch error for query:",
            (query as Query)?.queryKey,
            error,
          )

          // Remove the query from cache entirely to prevent serialization issues
          // The client will refetch it
          const cache = queryClient.getQueryCache()
          const existingQuery = cache.find({
            queryKey: (query as Query).queryKey,
          })
          if (existingQuery) {
            cache.remove(existingQuery)
          }

          // Don't rethrow - let other queries succeed
          return null
        }
      }),
    )
  } catch (error) {
    console.error("prefetch error", error)
  }

  // Clear any failed queries that might contain non-serializable error objects
  const cache = queryClient.getQueryCache()
  const allQueries = cache.getAll()

  allQueries.forEach((query) => {
    if (query.state.status === "error") {
      console.log(
        "Removing failed query from cache before dehydration:",
        query.queryKey,
      )
      cache.remove(query)
    }
  })

  return {
    dehydratedState: dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => {
        // Only dehydrate successful queries - failed queries contain
        // non-serializable error objects with axios config, FormData, Blob, etc.
        if (query.state.status !== "success") {
          console.log(
            "Skipping query due to non-success status:",
            query.state.status,
          )
          return false
        }
        // Test if just the data is serializable (avoid serializing the entire state
        // which might contain functions in error objects or other metadata)
        try {
          JSON.stringify(query.state.data)
          return true
        } catch (error) {
          console.warn(
            `Skipping dehydration of query ${query.queryHash} due to non-serializable data:`,
            error,
          )
          return false
        }
      },
    }),
    queryClient,
  }
}
