"use client"

import React from "react"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

/**
 * Gates the whole /organizational-learning route on its rollout flag.
 *
 * Flags are evaluated client-side only in this app, so waiting on
 * `flagsLoaded` matters: without it the page would 404 for a beat before
 * PostHog answers, even for users who should see it.
 */
const OrganizationalLearningFlagGate = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const enabled = useFeatureFlagEnabled(FeatureFlags.OrganizationalLearning)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!flagsLoaded) return null
  if (!enabled) return notFound()
  return <>{children}</>
}

export default OrganizationalLearningFlagGate
