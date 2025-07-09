import { ChannelCounts } from "api/v0"
import { login } from "./urls"
import { redirect, usePathname, useSearchParams } from "next/navigation"

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
   * NOTES:
   *  1. This is reactive; if current URL changes, the result of this hook
   *     will update and trigger re-renders. This makes it suitable for use as
   *     an href.
   *  2. However, the use of search params / pathname hooks may require Suspense
   *     or NextJS's dynamic rendering.
   *
   */
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return login({ pathname, searchParams })
}

/**
 * Redirect user to login route with ?next=<current-url>.
 */
const redirectLoginToCurrent = (): never => {
  redirect(
    /**
     * Calculating the ?next=<current-url> via window.location is appropriate
     * here since it happens time of redirect call.
     */
    login({
      pathname: window.location.pathname,
      searchParams: new URLSearchParams(window.location.search),
    }),
  )
}

export {
  getSearchParamMap,
  aggregateProgramCounts,
  aggregateCourseCounts,
  getCsrfToken,
  useLoginToCurrent,
  redirectLoginToCurrent,
}
