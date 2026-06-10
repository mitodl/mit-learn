"use client"

import React from "react"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

const HacksnackFlagGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const hacksnackEnabled = useFeatureFlagEnabled(FeatureFlags.Hacksnack)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!flagsLoaded) return null
  if (!hacksnackEnabled) return notFound()
  return <>{children}</>
}

export default HacksnackFlagGate
