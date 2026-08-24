import type { AppRoutes } from "../../.next/types/routes"

/**
 * Registry of URL query params the app is allowed to read.
 *
 * Fastly keys its cache for this app on a whitelist of query params
 * (ol-infrastructure: .../mit_learn/snippets/cache_key_query_whitelist.vcl).
 * A param NOT in that whitelist does not distinguish cache entries: if the
 * server's output depended on it, users would receive whichever variant was
 * cached first. This registry makes reads of unregistered params a type
 * error, so every param the app can read is one the CDN keys on.
 * See https://github.com/mitodl/hq/issues/12925.
 *
 * To use a new query param: add it to the Fastly whitelist in
 * ol-infrastructure FIRST, then to APP_SERVER_PARAMS here.
 *
 * (`_rsc`, the remaining Fastly whitelist entry, is framework-managed and
 * never read by app code, so it is deliberately not registered.)
 *
 * Known exception: `resource_title`, `syllabus`, `syllabus_only`, and
 * `recommender` are read via ol-components' RoutedDrawer (exempt from the
 * useSearchParams import ban) without being registered or cache-keyed. That
 * is safe only while drawer content renders nothing during SSR (RoutedDrawer
 * mounts closed and opens in an effect, with no `keepMounted`). If drawers
 * ever SSR their content, these params must be added to the Fastly whitelist
 * and this registry.
 */

/** Mirrors Object.keys(resourceSearchValidators) — pinned by searchParams.test.ts */
const RESOURCE_SEARCH_PARAMS = [
  "aggregations",
  "certification",
  "certification_type",
  "content_file_score_weight",
  "course_feature",
  "delivery",
  "department",
  "dev_mode",
  "free",
  "id",
  "level",
  "limit",
  "max_incompleteness_penalty",
  "min_score",
  "ocw_topic",
  "offered_by",
  "offset",
  "platform",
  "professional",
  "q",
  "resource_category",
  "resource_type",
  "resource_type_group",
  "search_mode",
  "show_ocw_files",
  "slop",
  "sortby",
  "topic",
  "yearly_decay_percent",
] as const

const APP_SERVER_PARAMS = [
  "resource",
  "page",
  "vector_search",
  "playlist",
  "t",
  "token",
  "error_code",
  "content_type",
  "next",
  "enrollment_status",
  "error_type",
  "enrollment_title",
  "enrollment_org_id",
  "order_status",
  "order_id",
  "account_action",
  "account_action_status",
] as const

const SERVER_KEYED_PARAMS = [
  ...RESOURCE_SEARCH_PARAMS,
  ...APP_SERVER_PARAMS,
] as const

type ServerSearchParam = (typeof SERVER_KEYED_PARAMS)[number]

/**
 * Read-only view of URL query params whose named lookups (`get`/`getAll`/
 * `has`) accept registered params only. Use this as the parameter type of
 * any helper that reads params by name: it prevents the helper body from
 * reading unregistered names, while still accepting the useAppSearchParams
 * result AND plain URLSearchParams values (whose lookups take any string).
 */
interface RegisteredSearchParams {
  get(name: ServerSearchParam): string | null
  getAll(name: ServerSearchParam): string[]
  has(name: ServerSearchParam): boolean
  keys(): Iterable<string>
  toString(): string
}

/**
 * Drop-in replacement for Next's global `PageProps` that narrows
 * `searchParams` to the cache-key whitelist. Enforced within `main/src` by
 * the `@typescript-eslint/no-restricted-types` ban on `PageProps`.
 */
type AppPageProps<Route extends AppRoutes> = Omit<
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- the one sanctioned PageProps reference; this is the wrapper
  PageProps<Route>,
  "searchParams"
> & {
  searchParams: Promise<Partial<Record<ServerSearchParam, string | string[]>>>
}

export { RESOURCE_SEARCH_PARAMS, SERVER_KEYED_PARAMS }
export type { ServerSearchParam, RegisteredSearchParams, AppPageProps }
