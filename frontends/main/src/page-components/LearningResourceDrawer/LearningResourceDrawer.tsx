import React, { useCallback } from "react"
import { RESOURCE_DRAWER_QUERY_PARAM } from "@/common/urls"
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import LearningResourceDrawerV2 from "./LearningResourceDrawerV2"
import LearningResourceDrawerV1 from "./LearningResourceDrawerV1"
import { FeatureFlags } from "@/common/feature_flags"

const LearningResourceDrawer = () => {
  const drawerV2 = useFeatureFlagEnabled(FeatureFlags.DrawerV2Enabled)
  return drawerV2 ? <LearningResourceDrawerV2 /> : <LearningResourceDrawerV1 />
}

const getOpenDrawerSearchParams = (
  current: ReadonlyURLSearchParams,
  resourceId: number,
) => {
  const newSearchParams = new URLSearchParams(current)
  newSearchParams.set(RESOURCE_DRAWER_QUERY_PARAM, resourceId.toString())
  return newSearchParams
}

const useResourceDrawerHref = () => {
  const searchParams = useSearchParams()

  return useCallback(
    (resourceId: number) => {
      const hash = window?.location.hash
      return `?${getOpenDrawerSearchParams(searchParams, resourceId)}${hash || ""}`
    },
    [searchParams],
  )
}

export default LearningResourceDrawer
export { useResourceDrawerHref }
