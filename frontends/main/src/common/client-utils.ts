import { ChannelCounts } from "api/v0"
import { auth } from "./urls"
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

/**
 * Returns a URL to authentication that redirects to current page after auth.
 *
 * By default, new users will be redirected to default signup destination.
 * If `signup` is true, they will be redirected to the current page.
 */
const useAuthToCurrent = ({ signup }: { signup?: boolean } = {}) => {
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
  const current = { pathname, searchParams }
  return auth({
    loginNext: current,
    signupNext: signup ? current : undefined,
  })
}

/**
 * Redirect user to auth. After auth:
 *  - existing users redirected to their current URL
 * - new users redirected to the default signup destination, unless `signup` is true.
 */
const redirectAuthToCurrent = ({
  signup,
}: {
  /**
   * Whether to redirect signup to current; by default, false. New users
   * will be redirected to the default signup destination.
   */
  signup?: boolean
} = {}): never => {
  const current = {
    pathname: window.location.pathname,
    searchParams: new URLSearchParams(window.location.search),
  }
  redirect(
    /**
     * Calculating the ?next=<current-url> via window.location is appropriate
     * here since it happens time of redirect call.
     */
    auth({
      loginNext: current,
      signupNext: signup ? current : undefined,
    }),
  )
}

export {
  getSearchParamMap,
  aggregateProgramCounts,
  aggregateCourseCounts,
  getCsrfToken,
  useAuthToCurrent,
  redirectAuthToCurrent,
}
