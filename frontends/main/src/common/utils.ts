import { ChannelCounts } from "api/v0"
import { login } from "./urls"
import { usePathname, useSearchParams } from "next/navigation"

const getSearchParamMap = (urlParams: URLSearchParams) => {
  const params: Record<string, string[] | string> = {}
  for (const [key] of urlParams.entries()) {
    params[key] = urlParams.getAll(key)
  }
  return params
}

const aggregateProgramCounts = (
  groupBy: string,
  data: Array<ChannelCounts>,
): Record<string, number> => {
  return Object.fromEntries(
    Object.entries(data).map(([_key, value]) => {
      return [value[groupBy as keyof ChannelCounts], value.counts.programs]
    }),
  )
}

const aggregateCourseCounts = (
  groupBy: string,
  data: Array<ChannelCounts>,
): Record<string, number> => {
  return Object.fromEntries(
    Object.entries(data).map(([_key, value]) => {
      return [value[groupBy as keyof ChannelCounts], value.counts.courses]
    }),
  )
}

function getCookie(name: string) {
  if (typeof document === "undefined") {
    return ""
  }
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift()
  }
}
/**
 * Returns CsrfToken from cookie if it is present
 */
const getCsrfToken = () => {
  return (
    getCookie(process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || "csrftoken") ?? ""
  )
}

const useLoginToCurrent = () => {
  /**
   * NOTE: In contrast to, say
   *  login({
   *    pathname: window.location.pathname,
   *    searchParams: new URLSearchParams(window.location.search)
   * }),
   * the version here is reactive: when pathname/searchParams change, the values
   * here update automatically and will (appropriately) trigger a re-render.
   *
   */
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return login({ pathname, searchParams })
}

export {
  getSearchParamMap,
  aggregateProgramCounts,
  aggregateCourseCounts,
  getCsrfToken,
  useLoginToCurrent,
}
