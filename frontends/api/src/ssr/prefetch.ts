import { QueryClient, dehydrate } from "@tanstack/react-query"
import type { Query } from "@tanstack/react-query"

// Utility to avoid repetition in server components
export const prefetch = async (queries: (Query | unknown)[]) => {
  const queryClient = new QueryClient()

  await Promise.all(
    queries.map((query) => queryClient.prefetchQuery(query as Query)),
  )

  return dehydrate(queryClient)
}
