import { useCallback } from "react"
import { RESOURCE_DRAWER_PARAMS } from "@/common/urls"
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation"

const getOpenDrawerSearchParams = (
  current: ReadonlyURLSearchParams,
  resourceId: number,
) => {
  const newSearchParams = new URLSearchParams(current)
  newSearchParams.set(RESOURCE_DRAWER_PARAMS.resource, resourceId.toString())
  return newSearchParams
}

const useResourceDrawerHref = () => {
  const searchParams = useSearchParams()

  return useCallback(
    (resourceId: number) => {
      const hash = typeof window !== "undefined" && window?.location.hash
      return `?${getOpenDrawerSearchParams(searchParams, resourceId)}${hash || ""}`
    },
    [searchParams],
  )
}

export { useResourceDrawerHref }
