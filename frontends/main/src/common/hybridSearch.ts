import type { RegisteredSearchParams } from "@/common/searchParams"
import { env } from "@/env"

/**
 * Hybrid (vector + keyword) search is the site-wide default for the search
 * page and every channel page.
 *
 * Rolling back to OpenSearch is a two-part kill switch, because the two halves
 * of the app resolve it differently:
 *
 *  - `disable-hybrid-search` (PostHog) takes effect immediately, with no
 *    deploy, but is only readable in the browser.
 *  - `NEXT_PUBLIC_DISABLE_HYBRID_SEARCH=true` is readable at request time on
 *    the server too, so server components prefetch the same endpoint the
 *    client will use instead of prefetching a hybrid query the client
 *    immediately discards.
 *
 * Either one alone disables hybrid search. Flip the PostHog flag to stop the
 * bleeding, then set the env var to make the rollback complete.
 */
export const HYBRID_SEARCH_DEFAULT = true

/**
 * The `vector_search` URL param, an explicit per-request override that wins
 * over both kill switches. Returns `null` when the param is absent or
 * unrecognized, meaning "no override".
 */
export const getHybridSearchOverride = (
  searchParams: RegisteredSearchParams,
): boolean | null => {
  const value = searchParams.get("vector_search")
  if (value === "true") return true
  if (value === "false") return false
  return null
}

/**
 * The env half of the kill switch. Readable on both server and client, so both
 * agree without waiting on PostHog.
 */
export const isHybridSearchDisabledByEnv = (): boolean =>
  env("NEXT_PUBLIC_DISABLE_HYBRID_SEARCH") === "true"

/**
 * Resolve hybrid search from the switches a server component can see. Client
 * components must use `useHybridSearchEnabled` instead, which also consults
 * the PostHog flag.
 */
export const isHybridSearchEnabled = (
  searchParams: RegisteredSearchParams,
): boolean => {
  const override = getHybridSearchOverride(searchParams)
  if (override !== null) return override
  if (isHybridSearchDisabledByEnv()) return false
  return HYBRID_SEARCH_DEFAULT
}
