import {
  FeatureFlags,
  flagFallback,
  type ServerFlags,
} from "@/common/feature_flags"
import type { RegisteredSearchParams } from "@/common/searchParams"
import { env } from "@/env"

/**
 * Hybrid (vector + keyword) search is the site-wide default for the search
 * page and every channel page.
 *
 * Rolling back to OpenSearch is a two-part kill switch:
 *
 *  - `disable-hybrid-search` (PostHog) takes effect with no deploy. The
 *    browser reads it from PostHog directly. The server reads it too when
 *    `POSTHOG_SECRET_KEY` is set, after its next 5-minute poll of the flag
 *    definitions; HTML already cached keeps the old value until it expires or
 *    is purged. When the server has no value for the flag, its env default
 *    (`NEXT_PUBLIC_FEATURE_disable_hybrid_search`) applies.
 *  - `NEXT_PUBLIC_DISABLE_HYBRID_SEARCH=true` is readable at request time on
 *    the server and the client alike, with no PostHog involved. When it is
 *    `true`, hybrid search is off on both whatever PostHog says.
 *
 * Either one alone disables hybrid search.
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
 * Resolve hybrid search on the server: the URL override, then the env kill
 * switch, then `disable-hybrid-search` as the client hook's server render
 * resolves it: the value in `serverFlags` (empty when the server cannot
 * evaluate flags), else the flag's env default. Client components must use
 * `useHybridSearchEnabled` instead, which also consults PostHog in the browser.
 */
export const isHybridSearchEnabled = (
  searchParams: RegisteredSearchParams,
  serverFlags: ServerFlags,
): boolean => {
  const override = getHybridSearchOverride(searchParams)
  if (override !== null) return override
  if (isHybridSearchDisabledByEnv()) return false
  if (flagFallback(FeatureFlags.DisableHybridSearch, serverFlags)) return false
  return HYBRID_SEARCH_DEFAULT
}
