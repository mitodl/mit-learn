import type { RegisteredSearchParams } from "@/common/searchParams"

/**
 * Hybrid (vector + keyword) search is the site-wide default for the search
 * page and every channel page. See `useHybridSearchEnabled` for the PostHog
 * kill switch that rolls search back to OpenSearch.
 */
export const HYBRID_SEARCH_DEFAULT = true

/**
 * The `vector_search` URL param, an explicit per-request override that wins
 * over the PostHog flag. Returns `null` when the param is absent or
 * unrecognized, meaning "no override".
 *
 * Server components cannot read PostHog flags, so they combine this with
 * `HYBRID_SEARCH_DEFAULT` to decide what to prefetch. When
 * `disable-hybrid-search` has rolled search back to OpenSearch, the client
 * refetches; the prefetch is a performance optimization, not the source of
 * truth.
 */
export const getHybridSearchOverride = (
  searchParams: RegisteredSearchParams,
): boolean | null => {
  const value = searchParams.get("vector_search")
  if (value === "true") return true
  if (value === "false") return false
  return null
}
