"use client"

import React from "react"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

/**
 * Gates Arithmix routes behind the `FeatureFlags.Arithmix` feature flag.
 *
 * While flags are still loading, renders nothing to avoid prematurely 404ing
 * users whose flags are bootstrapped client-side. Once flags are loaded and the
 * flag is disabled, triggers a `notFound()`. When enabled, renders `children`.
 */
const ArithmixFlagGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const arithmixEnabled = useFeatureFlagEnabled(FeatureFlags.Arithmix)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!arithmixEnabled) {
    return flagsLoaded ? notFound() : null
  }

  return <>{children}</>
}

export default ArithmixFlagGate
