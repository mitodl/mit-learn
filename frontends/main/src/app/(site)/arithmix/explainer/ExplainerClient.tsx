"use client"

import React from "react"
import dynamic from "next/dynamic"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

// The mynumbers package accesses `document` at module-evaluation time, so it
// must be loaded client-side only (no SSR).
const ExplainerPage = dynamic(
  () => import("mynumbers").then((mod) => mod.ExplainerPage),
  { ssr: false },
)

const ExplainerClient: React.FC = () => {
  const arithmixEnabled = useFeatureFlagEnabled(FeatureFlags.Arithmix)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!arithmixEnabled) {
    return flagsLoaded ? notFound() : null
  }

  return <ExplainerPage />
}

export default ExplainerClient
