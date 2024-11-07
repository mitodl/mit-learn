import { useEffect } from "react"
import type { QueryClient } from "@tanstack/react-query"

export const useQueryCacheWarning = (queryClient: QueryClient) => {
  useEffect(() => {
    const onLoad = () => {
      queryClient.setQueryData(["initialRenderComplete"], true)
      window.removeEventListener("load", onLoad)

      const prefetchedKeys = queryClient.getQueryData<string[]>([
        "prefetchedKeys",
      ])

      const nonQueryKeys = new Set([
        '["prefetchedKeys"]',
        '["initialRenderComplete"]',
      ])

      const initialKeys = new Set(
        queryClient.getQueryData<string[]>(["initialKeys"]),
      )

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
