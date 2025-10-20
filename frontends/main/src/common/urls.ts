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
export const ARTICLES_DETAILS = "/articles/[id]"
export const ARTICLES_EDIT = "/articles/[id]/edit"
export const ARTICLES_CREATE = "/articles/new"
export const articlesView = (id: number) =>
  generatePath(ARTICLES_DETAILS, { id: String(id) })
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
if (process.env.NODE_ENV !== "production") {
  invariant(!ORIGIN?.endsWith("/"), "NEXT_PUBLIC_ORIGIN should not end with /")
}

const MITOL_API_BASE_URL = process.env.NEXT_PUBLIC_MITOL_API_BASE_URL

export const DASHBOARD_VIEW = "/dashboard/[tab]"
const dashboardView = (tab: string) => generatePath(DASHBOARD_VIEW, { tab })

export const DASHBOARD_HOME = "/dashboard"
export const MY_LISTS = dashboardView("my-lists")
export const PROFILE = dashboardView("profile")
export const SETTINGS = dashboardView("settings")

export const USERLIST_VIEW = "/dashboard/my-lists/[id]"
export const userListView = (id: number) =>
  generatePath(USERLIST_VIEW, { id: String(id) })
export const ORGANIZATION_VIEW = "/dashboard/organization/[slug]"
export const organizationView = (slug: string) =>
  generatePath(ORGANIZATION_VIEW, { slug: slug })

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

export const SEARCH_COURSE = querifiedSearchUrl({ resource_category: "course" })

export const SEARCH_PROGRAM = querifiedSearchUrl({
  resource_category: "program",
})

export const SEARCH_LEARNING_MATERIAL = querifiedSearchUrl({
  resource_category: "learning_material",
})

export const LOGIN = `${MITOL_API_BASE_URL}/login`
export const LOGOUT = `${MITOL_API_BASE_URL}/logout/`

type UrlDescriptor = {
  pathname: string | null
  searchParams: URLSearchParams | null
  hash?: string | null
}
export type LoginUrlOpts = {
  /**
   * URL to redirect to after login.
   */
  loginNext: UrlDescriptor
  /**
   * URL to redirect to after signup.
   */
  signupNext?: UrlDescriptor
}

const DEFAULT_SIGNUP_NEXT: UrlDescriptor = {
  pathname: DASHBOARD_HOME,
  searchParams: null,
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
  const { loginNext, signupNext = DEFAULT_SIGNUP_NEXT } = opts
  const encode = (value: UrlDescriptor) => {
    const pathname = value.pathname ?? "/"
    const searchParams = value.searchParams ?? new URLSearchParams()
    const hash = value.hash ?? ""
    /**
     * To include search parameters in the next URL, we need to encode them.
     * If we pass `?next=/foo/bar?cat=meow` directly, Django receives two separate
     * parameters: `next` and `cat`.
     *
     * There's no need to encode the path parameter (it might contain slashes,
     * but those are allowed in search parameters) so let's keep it readable.
     */
    const search = searchParams?.toString() ? `?${searchParams.toString()}` : ""
    return `${ORIGIN}${pathname}${encodeURIComponent(search)}${encodeURIComponent(hash)}`
  }
  const loginNextHref = encode(loginNext)
  const signupNextHref = encode(signupNext)
  return `${LOGIN}?next=${loginNextHref}&signup_next=${signupNextHref}`
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

export const COURSE_PAGE_VIEW = "/courses/[readableId]/"
