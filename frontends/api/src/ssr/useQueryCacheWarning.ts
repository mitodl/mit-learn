import { useEffect } from "react"
import type { QueryClient } from "@tanstack/react-query"

export const useQueryCacheWarning = (queryClient: QueryClient) => {
  useEffect(() => {
    const onLoad = () => {
      queryClient.setQueryData(["initialRenderComplete"], true)
      window.removeEventListener("load", onLoad)
    }
    if (document.readyState === "complete") {
      onLoad()
    } else {
      window.addEventListener("load", onLoad)
    }
  })
}
