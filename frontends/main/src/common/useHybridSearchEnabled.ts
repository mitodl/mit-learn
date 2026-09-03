"use client"

import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useAppSearchParams } from "@/common/useAppSearchParams"
import {
  HYBRID_SEARCH_DEFAULT,
  getHybridSearchOverride,
} from "@/common/hybridSearch"

/**
 * Whether search should use the hybrid (vector + keyword) endpoint rather than
 * OpenSearch.
 *
 * Hybrid search is the default. `disable-hybrid-search` is a kill switch:
 * enable that PostHog flag to roll the whole site back to OpenSearch. The flag
 * is deliberately inverted so that every "no" answer PostHog can give—flag
 * absent, flag disabled, flags not loaded yet—leaves the default in place.
 * That also means no OpenSearch flash on first paint.
 *
 * A `vector_search=true|false` URL param overrides the flag, which keeps the
 * admin toggle on the search page usable for side-by-side comparison.
 */
const useHybridSearchEnabled = (): boolean => {
  const searchParams = useAppSearchParams()
  const override = getHybridSearchOverride(searchParams)
  const hybridDisabled = useFeatureFlagEnabled(FeatureFlags.DisableHybridSearch)
  if (override !== null) return override
  if (hybridDisabled) return false
  return HYBRID_SEARCH_DEFAULT
}

export { useHybridSearchEnabled }
