"use client"

import React from "react"
import { notFound } from "next/navigation"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsSettled } from "@/common/useFeatureFlagsSettled"
import { useFeatureFlag } from "@/common/useFeatureFlag"

const EducatorFlagGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const enabled = useFeatureFlag(FeatureFlags.EducatorPage)
  const flagsSettled = useFeatureFlagsSettled()

  if (!flagsSettled) return null
  if (!enabled) return notFound()
  return <>{children}</>
}

export default EducatorFlagGate
