"use client"

import React from "react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import LearningResourceDrawerV2 from "./LearningResourceDrawerV2"
import LearningResourceDrawerV1 from "./LearningResourceDrawerV1"
import { FeatureFlags } from "@/common/feature_flags"

const LearningResourceDrawer = () => {
  const drawerV2 = useFeatureFlagEnabled(FeatureFlags.DrawerV2Enabled)
  return drawerV2 ? <LearningResourceDrawerV2 /> : <LearningResourceDrawerV1 />
}

export default LearningResourceDrawer
