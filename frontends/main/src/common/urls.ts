import invariant from "tiny-invariant"

const generatePath = (
  template: string,
  params: Record<string, string | number>,
): string => {
  return template.replace(/\[(\w+)\]/g, (_, key) => {
    if (params[key] === undefined) {
      throw new Error(`Missing parameter '${key}'`)
    }
    return encodeURIComponent(params[key] as string)
  })
}

export const HOME = "/"

export const ONBOARDING = "/onboarding"

export const LEARNINGPATH_LISTING = "/learningpaths"
export const LEARNINGPATH_VIEW = "/learningpaths/[id]"
export const learningPathsView = (id: number) =>
  generatePath(LEARNINGPATH_VIEW, { id: String(id) })
export const PROGRAMLETTER_VIEW = "/program_letter/[id]/view/"
export const programLetterView = (id: string) =>
  generatePath(PROGRAMLETTER_VIEW, { id: String(id) })
export const ARTICLES_LISTING = "/articles/"
export const ARTICLES_VIEW = "/articles/[id]"
export const ARTICLES_DRAFT_VIEW = "/articles/[id]/draft"
export const ARTICLES_EDIT = "/articles/[id]/edit"
export const ARTICLES_CREATE = "/articles/new"
export const articlesView = (id: string) =>
  generatePath(ARTICLES_VIEW, { id: String(id) })
export const articlesDraftView = (id: string) =>
  generatePath(ARTICLES_DRAFT_VIEW, { id: String(id) })
export const articlesEditView = (id: number) =>
  generatePath(ARTICLES_EDIT, { id: String(id) })

export const DEPARTMENTS = "/departments/"
export const TOPICS = "/topics/"

export const CHANNEL_VIEW = "/c/[channelType]/[name]" as const
export const CHANNEL_EDIT = "/c/[channelType]/[name]/manage/" as const
export const CHANNEL_EDIT_WIDGETS =
  "/c/[channelType]/[name]/manage/widgets/" as const
export const makeChannelViewPath = (channelType: string, name: string) =>
  generatePath(CHANNEL_VIEW, { channelType, name })
export const makeChannelEditPath = (channelType: string, name: string) =>
  generatePath(CHANNEL_EDIT, { channelType, name })
export const makeChannelManageWidgetsPath = (
  channelType: string,
  name: string,
) => generatePath(CHANNEL_EDIT_WIDGETS, { channelType, name })

const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN
invariant(ORIGIN, "NEXT_PUBLIC_ORIGIN must be set")
if (process.env.NODE_ENV !== "production") {
  invariant(!ORIGIN?.endsWith("/"), "NEXT_PUBLIC_ORIGIN should not end with /")
}

const MITOL_API_BASE_URL = process.env.NEXT_PUBLIC_MITOL_API_BASE_URL

export const DASHBOARD_VIEW = "/dashboard/[tab]"
const dashboardView = (tab: string) => generatePath(DASHBOARD_VIEW, { tab })

export const DASHBOARD_HOME = "/dashboard"
export const ENROLLMENT_ERROR_QUERY_PARAM = "enrollment_error"
export const DASHBOARD_HOME_ENROLLMENT_ERROR = `/dashboard?${ENROLLMENT_ERROR_QUERY_PARAM}=1`
export const MY_LISTS = dashboardView("my-lists")
export const PROFILE = dashboardView("profile")
export const SETTINGS = dashboardView("settings")

export const USERLIST_VIEW = "/dashboard/my-lists/[id]"
export const userListView = (id: number) =>
  generatePath(USERLIST_VIEW, { id: String(id) })
export const CONTRACT_VIEW =
  "/dashboard/organization/[orgSlug]/contract/[contractSlug]"
export const contractView = (orgSlug: string, contractSlug: string) =>
  generatePath(CONTRACT_VIEW, { orgSlug: orgSlug, contractSlug: contractSlug })
export const PROGRAM_VIEW = "/dashboard/program/[id]"
export const programView = (id: number) =>
  generatePath(PROGRAM_VIEW, { id: String(id) })

export const SEARCH = "/search"

export const ABOUT = "/about"
export const ABOUT_NON_DEGREE_LEARNING_FRAGMENT = "non-degree-learning"

export const ACCESSIBILITY = "https://accessibility.mit.edu/"

export const PRIVACY = "/privacy"

export const HONOR_CODE = "/honor_code"

export const TERMS = "/terms"

export const UNITS = "/units"

export const CONTACT = "mailto:mitlearn-support@mit.edu"

export const RECOMMENDER_QUERY_PARAM = "recommender"

export const RESOURCE_DRAWER_PARAMS = {
  resource: "resource",
  syllabus: "syllabus",
} as const

export const canonicalResourceDrawerUrl = (resourceId: number) =>
  `${process.env.NEXT_PUBLIC_ORIGIN}/search?${RESOURCE_DRAWER_PARAMS.resource}=${resourceId}`

export const querifiedSearchUrl = (
  params:
    | string
    | string[][]
    | URLSearchParams
    | Record<string, string>
    | undefined,
) => `${SEARCH}?${new URLSearchParams(params).toString()}`

export const SEARCH_NEW = querifiedSearchUrl({ sortby: "new" })

export const SEARCH_UPCOMING = querifiedSearchUrl({ sortby: "upcoming" })

export const SEARCH_POPULAR = querifiedSearchUrl({ sortby: "-views" })

export const SEARCH_FREE = querifiedSearchUrl({ free: "true" })

const CERTIFICATION_SEARCH_PARAMS = new URLSearchParams()
CERTIFICATION_SEARCH_PARAMS.append("certification_type", "professional")
CERTIFICATION_SEARCH_PARAMS.append("certification_type", "completion")
CERTIFICATION_SEARCH_PARAMS.append("certification_type", "micromasters")
export const SEARCH_CERTIFICATE = querifiedSearchUrl(
  CERTIFICATION_SEARCH_PARAMS,
)

export const SEARCH_COURSE = querifiedSearchUrl({
  resource_type_group: "course",
})

export const SEARCH_PROGRAM = querifiedSearchUrl({
  resource_type_group: "program",
})

export const SEARCH_LEARNING_MATERIAL = querifiedSearchUrl({
  resource_type_group: "learning_material",
})

export const LOGIN = `${MITOL_API_BASE_URL}/login`
export const LOGOUT = `${MITOL_API_BASE_URL}/logout/`

type UrlDescriptor = {
  pathname: string
  searchParams: URLSearchParams | null
}
export type LoginUrlOpts = {
  /**
   * URL to redirect to after login + signup.
   */
  next: UrlDescriptor
  /**
   * URL to redirect to after signup, overriding `next` for signup if provided.
   */
  signupNext?: UrlDescriptor
}

const stringifyUrlDescriptor = (val: UrlDescriptor) => {
  const url = new URL(ORIGIN)
  url.pathname = val.pathname
  if (val.searchParams) {
    val.searchParams.forEach((v, k) => url.searchParams.set(k, v))
  }
  return url.toString()
}
/**
 * Returns the URL to the authentication page (login and signup).
 *
 * NOTES:
 *  1. useAuthToCurrent() is a convenience function that uses the current
 *    pathname and search parameters to generate the next URL.
 *  2. `next` is required to encourage its use. You can explicitly pass `null`
 *    for values to skip them if desired.
 */
export const auth = (opts: LoginUrlOpts) => {
  const { next: loginNext, signupNext } = opts

  const url = new URL(LOGIN)
  url.searchParams.set("next", stringifyUrlDescriptor(loginNext))
  if (signupNext) {
    url.searchParams.set("signup_next", stringifyUrlDescriptor(signupNext))
  }
  return url.toString()
}

export const ECOMMERCE_CART = "/cart/" as const

export const B2B_ATTACH_VIEW = "/enrollmentcode/[code]"
export const b2bAttachView = (code: string) =>
  generatePath(B2B_ATTACH_VIEW, { code: code })

export const FACEBOOK_SHARE_BASE_URL =
  "https://www.facebook.com/sharer/sharer.php"
export const TWITTER_SHARE_BASE_URL = "https://x.com/share"
export const LINKEDIN_SHARE_BASE_URL =
  "https://www.linkedin.com/sharing/share-offsite"

export const COURSE_PAGE_VIEW = "/courses/[readableId]"
export const coursePageView = (readableId: string) =>
  generatePath(COURSE_PAGE_VIEW, { readableId })
export const PROGRAM_PAGE_VIEW = "/programs/[readableId]"
export const programPageView = (readableId: string) =>
  generatePath(PROGRAM_PAGE_VIEW, { readableId })
