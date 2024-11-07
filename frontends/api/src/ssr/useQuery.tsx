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
  const queryClient = useQueryClient()

  const cached = queryClient.getQueryState(options.queryKey!)

  const initialLoaded = queryClient.getQueryData(["initialRenderComplete"])

  if (!initialLoaded) {
    if (!cached) {
      console.warn(
        options.queryKey,
        "QueryCache was empty - content was not prefetched on the server for query key",
      )
    }
  }

  return useQueryOriginal(options)
}
