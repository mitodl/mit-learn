"use client"

import React from "react"
import { notFound } from "next/navigation"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { useFeatureFlag } from "@/common/useFeatureFlag"

const EducatorFlagGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const enabled = useFeatureFlag(FeatureFlags.EducatorPage)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!flagsLoaded) return null
  if (!enabled) return notFound()
  return <>{children}</>
}

export default EducatorFlagGate
