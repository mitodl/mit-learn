import { env, requiredEnv } from "@/env"
import type { V2ProgramDisplayMode } from "@mitodl/mitxonline-api-axios/v2"
import { slugify } from "@/common/slugs"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"

// matches ! $ & ' ( ) * + , ; = : @ ~
const SAFE_IN_PATH_SEGMENT =
  /%21|%24|%26|%27|%28|%29|%2A|%2B|%2C|%3B|%3D|%3A|%40|%7E/gi

const encodePathSegment = (pathSegment: string) => {
  const overAggressive = encodeURIComponent(pathSegment)
  return overAggressive.replace(SAFE_IN_PATH_SEGMENT, (match) =>
    decodeURIComponent(match),
  )
}

const generatePath = (
  template: string,
  params: Record<string, string | number>,
): string => {
  return template.replace(/\[(\w+)\]/g, (_, key) => {
    if (params[key] === undefined) {
      throw new Error(`Missing parameter '${key}'`)
    }
    return encodePathSegment(String(params[key]))
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
export const NEWS_LISTING = "/news/"
export const NEWS_VIEW = "/news/[id]"
export const NEWS_DRAFT_VIEW = "/news/[id]/draft"
export const NEWS_EDIT = "/news/[id]/edit"
export const NEWS_CREATE = "/news/new"
export const newsView = (id: string) =>
  generatePath(NEWS_VIEW, { id: String(id) })
export const newsDraftView = (id: string) =>
  generatePath(NEWS_DRAFT_VIEW, { id: String(id) })
export const newsEditView = (id: number) =>
  generatePath(NEWS_EDIT, { id: String(id) })

// Articles (served under /articles)
export const ARTICLES_LISTING = "/articles/"
export const ARTICLES_VIEW = "/articles/[id]"
export const ARTICLES_DRAFT_VIEW = "/articles/[id]/draft"
export const articleView = (id: string) =>
  generatePath(ARTICLES_VIEW, { id: String(id) })
export const articleDraftView = (id: string) =>
  generatePath(ARTICLES_DRAFT_VIEW, { id: String(id) })

// Generic website content editing routes
export const WEBSITE_CONTENT_CREATE = "/website_content/[type]/new"
export const WEBSITE_CONTENT_EDIT = "/website_content/[type]/[idOrSlug]/edit"
export const WEBSITE_CONTENT_DRAFTS = "/website_content/drafts"
export const websiteContentCreateView = (type: string) =>
  `/website_content/${type}/new`
export const websiteContentEditView = (
  type: string,
  idOrSlug: string | number,
) => `/website_content/${type}/${idOrSlug}/edit`
export const websiteContentDraftsView = (contentType?: string) =>
  contentType
    ? `${WEBSITE_CONTENT_DRAFTS}?content_type=${contentType}`
    : WEBSITE_CONTENT_DRAFTS

export const DEPARTMENTS = "/departments/"
export const TOPICS = "/topics/"

export const CHANNEL_VIEW = "/c/[channelType]/[name]" as const
export const makeChannelViewPath = (channelType: string, name: string) =>
  generatePath(CHANNEL_VIEW, { channelType, name })

const MITOL_API_BASE_URL = env("NEXT_PUBLIC_MITOL_API_BASE_URL")

export const DASHBOARD_VIEW = "/dashboard/[tab]"
const dashboardView = (tab: string) => generatePath(DASHBOARD_VIEW, { tab })

export const DASHBOARD_HOME = "/dashboard"
export const DASHBOARD_MY_LEARNING_ID = "my-learning"
export const DASHBOARD_MY_LEARNING = `${DASHBOARD_HOME}#${DASHBOARD_MY_LEARNING_ID}`
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
export const CONTRACT_ADMIN_VIEW =
  "/organization/[orgSlug]/contract/[contractSlug]/admin"
export const contractAdminView = (orgSlug: string, contractSlug: string) =>
  generatePath(CONTRACT_ADMIN_VIEW, { orgSlug, contractSlug })
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

export const CONTACT = "https://support.learn.mit.edu/"

export const RECOMMENDER_QUERY_PARAM = "recommender"

export const RESOURCE_DRAWER_PARAMS = {
  resource: "resource",
  resource_title: "resource_title",
  syllabus: "syllabus",
  syllabusOnly: "syllabus_only",
} as const

/**
 * Path slug segment from a title: the slug, or the literal "resource" when the
 * slug is blank (the canonical path's slug segment is mandatory — see the
 * readable-URLs spec, mitodl/hq#11210). The slug is cosmetic and ignored on
 * lookup.
 *
 * INVARIANT: canonical paths must round-trip Next's URL decoding
 * byte-identically — keep the slug charset to [a-z0-9-] and ids numeric, or
 * the [slug] pages' incoming-vs-canonical string compares could redirect a
 * URL to a spelling of itself and loop.
 */
const pathSlug = (title: string): string => slugify(title) || "resource"

/** Prefix a same-origin path with the public origin (for canonical tags). */
export const absoluteUrl = (path: string): string =>
  `${requiredEnv("NEXT_PUBLIC_ORIGIN")}${path}`

/**
 * Relative drawer URL on the search page:
 *   /search?resource={id}[&resource_title={slug}]
 * `resource` is the authoritative id; `resource_title` is a cosmetic slug,
 * omitted when blank and ignored on lookup.
 */
export const resourceDrawerSearch = (resourceId: number, title?: string) => {
  const slug = title ? slugify(title) : ""
  const params = new URLSearchParams({
    [RESOURCE_DRAWER_PARAMS.resource]: String(resourceId),
  })
  if (slug) params.set(RESOURCE_DRAWER_PARAMS.resource_title, slug)
  return `${SEARCH}?${params.toString()}`
}

export const canonicalResourceDrawerUrl = (
  resourceId: number,
  title: string | undefined,
) => absoluteUrl(resourceDrawerSearch(resourceId, title))

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
  // ORIGIN is read at call time (request time) so NEXT_PUBLIC_ORIGIN is
  // available — it is not set at build time in the standalone Docker image.
  // requiredEnv() is safe here: stringifyUrlDescriptor only runs when building
  // login/signup URLs at request time, never during `next build`.
  const url = new URL(requiredEnv("NEXT_PUBLIC_ORIGIN"))
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
export const LINKEDIN_ADD_TO_PROFILE_BASE_URL =
  "https://www.linkedin.com/profile/add"

export const COURSE_PAGE_VIEW = "/courses/[readableId]"
export const coursePageView = (readableId: string) =>
  generatePath(COURSE_PAGE_VIEW, { readableId })
// Each page-view builder appends a mandatory slug segment when a title is given
// (the slug, or the literal "resource" when blank). With an undefined title it
// emits the bare path, which still resolves and 307-redirects to canonical.
// `title` is required-but-undefinable so a call site can't silently omit it —
// passing undefined (e.g. a title still in flight) is a visible opt-in to the
// redirecting bare form. Id and slug are separate segments; the slug is
// cosmetic and ignored on lookup.
export const VIDEO_PLAYLIST_PAGE_VIEW = "/video-playlist/[id]"
export const videoPlaylistPageView = (
  id: string,
  title: string | undefined,
) => {
  const base = generatePath(VIDEO_PLAYLIST_PAGE_VIEW, { id })
  return title === undefined ? base : `${base}/${pathSlug(title)}`
}
export const PODCAST_PAGE_VIEW = "/podcast/[podcastId]"
export const podcastPageView = (id: string, title: string | undefined) => {
  const base = generatePath(PODCAST_PAGE_VIEW, { podcastId: id })
  return title === undefined ? base : `${base}/${pathSlug(title)}`
}
export const PODCAST_EPISODE_PAGE_VIEW =
  "/podcast/[podcastId]/podcast_episode/[episodeId]"
export const podcastEpisodePageView = (
  id: string,
  podcastId: string,
  title: string | undefined,
) => {
  const base = generatePath(PODCAST_EPISODE_PAGE_VIEW, {
    podcastId: String(podcastId), // bare context id
    episodeId: String(id),
  })
  return title === undefined ? base : `${base}/${pathSlug(title)}`
}
export const VIDEO_DETAIL_PAGE_VIEW = "/video/[videoId]"
export const videoDetailPageView = (
  videoId: number,
  playlistId: number | undefined,
  title: string | undefined,
) => {
  const path = generatePath(VIDEO_DETAIL_PAGE_VIEW, {
    videoId: String(videoId),
  })
  const base = title === undefined ? path : `${path}/${pathSlug(title)}`
  if (playlistId !== undefined) {
    const params = new URLSearchParams({ playlist: String(playlistId) })
    return `${base}?${params.toString()}`
  }
  return base
}
/**
 * Append a request's incoming search params to a canonical URL so redirects
 * preserve tracking params (e.g. utm_*). Params the canonical already sets
 * win, and `omit` lists params the canonical builder owns (always dropped
 * from the incoming set so a rejected value — e.g. a non-member `playlist` —
 * can't be re-forwarded and redirect again).
 */
export const carrySearchParams = (
  canonical: string,
  incoming: Record<string, string | string[] | undefined>,
  omit: string[] = [],
): string => {
  const [path, query] = canonical.split("?")
  const params = new URLSearchParams()
  Object.entries(incoming).forEach(([key, value]) => {
    if (omit.includes(key) || value === undefined) return
    const values = Array.isArray(value) ? value : [value]
    values.forEach((v) => params.append(key, v))
  })
  new URLSearchParams(query).forEach((value, key) => {
    params.delete(key)
    params.append(key, value)
  })
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export const PROGRAM_PAGE_VIEW = "/programs/[readableId]"
export const PROGRAM_AS_COURSE_PAGE_VIEW = "/courses/p/[readableId]"

export const programPageView = (program: {
  readable_id: string
  /**
   * If display_mode is "course", program should be rendered on a course page at
   * /courses/p/[readable_id] instead of /programs/[readable_id].
   *
   * NOTE:
   * Explicitly allow null/undefined since program.display_mode is required and
   * (at least according to our OpenAPI spec) optional:
   * ```ts
   * programPageView({
   *   readable_id: p.readable_id, display_mode: p.display_mode
   * })
   * ```
   * But require it (arg is not optional, i.e., not `display_mode?`) to
   * encourage callers to pass the value.
   */
  display_mode: V2ProgramDisplayMode | null | undefined
}) => {
  const pattern =
    program.display_mode === DisplayModeEnum.Course
      ? PROGRAM_AS_COURSE_PAGE_VIEW
      : PROGRAM_PAGE_VIEW
  return generatePath(pattern, { readableId: program.readable_id })
}
export const ocwLearnPageView = (originalUrl: string) => {
  const url = new URL(originalUrl)
  if (!url.hostname.includes("ocw.mit.edu")) {
    return originalUrl
  }
  return url.pathname.replace(/^\/courses/, "/courses/o")
}
