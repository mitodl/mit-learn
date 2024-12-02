"use client"

import React, { useCallback } from "react"
import { usePathname } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import LearningResourceDrawerV2 from "./LearningResourceDrawerV2"
import LearningResourceDrawerV1 from "./LearningResourceDrawerV1"
import { FeatureFlags } from "@/common/feature_flags"

const LearningResourceDrawer: React.FC = () => {
  const pathname = usePathname()
  const match = pathname.match(/\/resource\/(\d+)$/)
  const drawerV2 = useFeatureFlagEnabled(FeatureFlags.DrawerV2Enabled)
  const resourceId = match?.[1]
  if (!resourceId) return null
  return drawerV2 ? (
    <LearningResourceDrawerV2 resourceId={Number(resourceId)} />
  ) : (
    <LearningResourceDrawerV1 resourceId={Number(resourceId)} />
  )
}

const useResourceDrawerHref = () => {
  const pathname = usePathname()

  return useCallback(
    (resourceId: number) => {
      let path = ""
      const match = pathname.match(/(.+)\/resource\/(\d+)$/)
      if (match) {
        path = match[0]
      } else {
        path = pathname
      }

      return `${path}${path.endsWith("/") ? "" : "/"}resource/${resourceId}`
    },
    [pathname],
  )
}

export default LearningResourceDrawer
export { useResourceDrawerHref }
//
