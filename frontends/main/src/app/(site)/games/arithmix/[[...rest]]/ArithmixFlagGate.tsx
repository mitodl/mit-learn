"use client"

import React from "react"
import { notFound } from "next/navigation"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { useFeatureFlag } from "@/common/useFeatureFlag"

/**
 * Gates Arithmix routes behind the `FeatureFlags.Arithmix` feature flag.
 *
 * Renders `children` while the flag reads on. While it reads off and flags are
 * still loading, renders nothing, so users the flag is on for aren't 404ed on
 * its env default. Once flags are loaded, an off flag triggers `notFound()`.
 */
const ArithmixFlagGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const arithmixEnabled = useFeatureFlag(FeatureFlags.Arithmix)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!arithmixEnabled) {
    return flagsLoaded ? notFound() : null
  }

  return <>{children}</>
}

export default ArithmixFlagGate
