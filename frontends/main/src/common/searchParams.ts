import type { AppRoutes } from "../../.next/types/routes"

/**
 * Registry of URL query params the app is allowed to read.
 *
 * Fastly keys its cache for this app on a whitelist of query params
 * (ol-infrastructure: .../mit_learn/snippets/cache_key_query_whitelist.vcl).
 * A param NOT in that whitelist does not distinguish cache entries: if the
 * server's output depended on it, users would receive whichever variant was
 * cached first. This registry makes reads of unclassified params a type error.
 * See https://github.com/mitodl/hq/issues/12925.
 *
 * To use a new query param:
 * - If the server's response depends on it (read via page `searchParams`, or
 *   read during render in a client component): add it to the Fastly whitelist
 *   in ol-infrastructure FIRST, then to APP_SERVER_PARAMS here.
 * - If it is only read client-side (effects, handlers) and must never affect
 *   what the server sends: add it to CLIENT_ONLY_PARAMS. On hard loads its
 *   first paint may not reflect the param (self-corrects at hydration).
 *
 * (`_rsc`, the remaining Fastly whitelist entry, is framework-managed and
 * never read by app code, so it is deliberately not registered.)
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
] as const

const SERVER_KEYED_PARAMS = [
  ...RESOURCE_SEARCH_PARAMS,
  ...APP_SERVER_PARAMS,
] as const

const CLIENT_ONLY_PARAMS = [
  "enrollment_status",
  "error_type",
  "enrollment_title",
  "enrollment_org_id",
  "order_status",
  "order_id",
  "account_action",
  "account_action_status",
] as const

type ServerSearchParam = (typeof SERVER_KEYED_PARAMS)[number]
type AppSearchParam = ServerSearchParam | (typeof CLIENT_ONLY_PARAMS)[number]

/**
 * Drop-in replacement for Next's global `PageProps` that narrows
 * `searchParams` to the cache-key whitelist. Enforced repo-wide by the
 * `@typescript-eslint/no-restricted-types` ban on `PageProps`.
 */
type AppPageProps<Route extends AppRoutes> = Omit<
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- the one sanctioned PageProps reference; this is the wrapper
  PageProps<Route>,
  "searchParams"
> & {
  searchParams: Promise<Partial<Record<ServerSearchParam, string | string[]>>>
}

export {
  RESOURCE_SEARCH_PARAMS,
  APP_SERVER_PARAMS,
  SERVER_KEYED_PARAMS,
  CLIENT_ONLY_PARAMS,
}
export type { ServerSearchParam, AppSearchParam, AppPageProps }
