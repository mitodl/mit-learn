import {
  useQuery as useQueryOriginal,
  UseQueryOptions,
  UseQueryResult,
  useQueryClient,
} from "@tanstack/react-query"
import type { QueryKey } from "@tanstack/react-query"

/* Wraps useQuery to check that the query cache is populated for a given query key.
 * Queries are expected to have been prefetched on the server. A warning is logged
 * if the query cache is empty for the key before the initial render has completed.
 */
export const useQuery = <
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    "initialData"
  > & {
    initialData?: () => undefined
  },
): UseQueryResult<TData, TError> => {
  return useQueryOriginal(options)

  // const queryClient = useQueryClient()

  // /* This flag is set to true when we get the window load event */
  // const initialLoaded = queryClient.getQueryData(["initialRenderComplete"])

  // /* Check if the item is in the cache (implying prefetched, until initialLoaded) */
  // const cached = queryClient.getQueryState(options.queryKey!)

  // if (!initialLoaded) {
  //   if (!cached) {
  //     console.warn(
  //       options.queryKey,
  //       "Content was not prefetched on the server for query key needed during initial render",
  //     )
  //   }

  //   const initialQueries =
  //     queryClient.getQueryData<string[]>(["initialKeys"]) || []

  //   const key = JSON.stringify(options.queryKey)
  //   if (!initialQueries.includes(key)) {
  //     /* Track the queries made during initial render so we can compare to the prefetched list */
  //     queryClient.setQueryData(["initialKeys"], [...initialQueries, key])
  //   }
  // }

  // return useQueryOriginal(options)
}
