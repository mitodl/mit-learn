"use client"

import React from "react"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

class NotFoundOnError extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      // notFound() throws NEXT_NOT_FOUND, which propagates to Next's route-level
      // not-found boundary and renders the 404 page.
      return notFound()
    }
    return this.props.children
  }
}

const ArithmixFlagGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const arithmixEnabled = useFeatureFlagEnabled(FeatureFlags.Arithmix)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!arithmixEnabled) {
    return flagsLoaded ? notFound() : null
  }

  return <NotFoundOnError>{children}</NotFoundOnError>
}

export default ArithmixFlagGate
