import { ChannelCounts } from "api/v0"
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

export {
  getSearchParamMap,
  aggregateProgramCounts,
  aggregateCourseCounts,
  getCsrfToken,
}
