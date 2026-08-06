import { useCallback } from "react"
import { useSearchParams } from "next/navigation"
import type { LearningResource } from "api"
import { setResourceParams } from "@/common/urls"

/**
 * The URL a card click pushes: the *current* page's URL plus the drawer's
 * params, preserving every other param and the fragment. This is deliberately
 * not the card's href — the href is the canonical `/search?resource=…` URL
 * (see `resourceDrawerSearch`), which is what crawlers and Copy Link Address
 * should get.
 */
const useResourceDrawerPushUrl = () => {
  const searchParams = useSearchParams()

  return useCallback(
    (resource: Pick<LearningResource, "id" | "title">) => {
      const params = new URLSearchParams(searchParams)
      setResourceParams(params, resource.id, resource.title)
      const hash = typeof window === "undefined" ? "" : window.location.hash
      return `?${params}${hash}`
    },
    [searchParams],
  )
}

export { useResourceDrawerPushUrl }
