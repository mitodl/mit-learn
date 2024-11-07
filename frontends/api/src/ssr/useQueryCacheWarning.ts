import { useEffect } from "react"
import type { QueryClient } from "@tanstack/react-query"

export const useQueryCacheWarning = (queryClient: QueryClient) => {
  useEffect(() => {
    const onLoad = () => {
      queryClient.setQueryData(["initialRenderComplete"], true)
      window.removeEventListener("load", onLoad)

      /* These are the known keys set while prefetching on the server before dehydrating (serializing) for the client */
      const prefetchedKeys = queryClient.getQueryData<string[]>([
        "prefetchedKeys",
      ])

      /* These are the cache entries we set ourselves that are not queries, so we ignore below */
      const nonQueryKeys = new Set([
        '["prefetchedKeys"]',
        '["initialRenderComplete"]',
      ])

      /* These are set as the components request useQuery() during initial render */
      const initialKeys = new Set(
        queryClient.getQueryData<string[]>(["initialKeys"]),
      )

      /* We can find the keys prefetched but not used by any component during initial render */
      const superfluousKeys = prefetchedKeys?.filter(
        (key) => !nonQueryKeys.has(key) && !initialKeys.has(key),
      )

      if (superfluousKeys?.length) {
        superfluousKeys.forEach((key) => {
          console.warn(
            key,
            "Content was prefetched on the server for query key not needed during initial render",
          )
        })
      }
    }
    if (document.readyState === "complete") {
      onLoad()
    } else {
      window.addEventListener("load", onLoad)
    }
  })
}
