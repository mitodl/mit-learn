"use client"

import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useAppSearchParams } from "@/common/useAppSearchParams"
import {
  HYBRID_SEARCH_DEFAULT,
  getHybridSearchOverride,
  isHybridSearchDisabledByEnv,
} from "@/common/hybridSearch"

/**
 * Whether search should use the hybrid (vector + keyword) endpoint rather than
 * OpenSearch. Hybrid search is the default; see @/common/hybridSearch for the
 * two halves of the kill switch that roll it back.
 *
 * The PostHog flag is deliberately inverted so that every "no" answer PostHog
 * can give—flag absent, flag disabled, flags not loaded yet—leaves the default
 * in place. That also means no OpenSearch flash on first paint.
 */
const useHybridSearchEnabled = (): boolean => {
  const searchParams = useAppSearchParams()
  const flagDisabled = useFeatureFlagEnabled(FeatureFlags.DisableHybridSearch)
  const override = getHybridSearchOverride(searchParams)
  if (override !== null) return override
  // Either half of the kill switch is enough to roll back.
  if (flagDisabled || isHybridSearchDisabledByEnv()) return false
  return HYBRID_SEARCH_DEFAULT
}

export { useHybridSearchEnabled }
