import { QueryClient, dehydrate } from "@tanstack/react-query"
import type { QueryKey, QueryFunction } from "@tanstack/react-query"

type Query = {
  queryKey: QueryKey
  queryFn: QueryFunction
}

// TODO fix unknown type
export const prefetch = async (queries: (Query | unknown)[]) => {
  const queryClient = new QueryClient()

  await Promise.all(
    queries.map((query) => queryClient.prefetchQuery(query as Query)),
  )

  const prefetchedKeys = queryClient
    .getQueriesData([])
    .map((item) => JSON.stringify(item[0]))

  /* Set the prefetched keys so we can check them after first
   * render to make sure we are not prefetching anything unnecessarily */
  queryClient.setQueryData(["prefetchedKeys"], prefetchedKeys)

  return dehydrate(queryClient)
}
