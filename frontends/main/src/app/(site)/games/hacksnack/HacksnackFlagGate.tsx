"use client"

import React from "react"
import { notFound } from "next/navigation"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { useFeatureFlag } from "@/common/useFeatureFlag"

const HacksnackFlagGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const hacksnackEnabled = useFeatureFlag(FeatureFlags.Hacksnack)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!flagsLoaded) return null
  if (!hacksnackEnabled) return notFound()
  return <>{children}</>
}

export default HacksnackFlagGate
