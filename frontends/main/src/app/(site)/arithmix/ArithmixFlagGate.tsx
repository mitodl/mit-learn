"use client"

import React, { useEffect, useState } from "react"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

type ArithmixFlagGateProps<P extends object = Record<string, never>> = {
  load: () => Promise<React.ComponentType<P>>
  componentProps?: P
}

function ArithmixFlagGate<P extends object = Record<string, never>>({
  load,
  componentProps,
}: ArithmixFlagGateProps<P>) {
  const arithmixEnabled = useFeatureFlagEnabled(FeatureFlags.Arithmix)
  const flagsLoaded = useFeatureFlagsLoaded()

  const [Component, setComponent] = useState<React.ComponentType<P> | null>(
    null,
  )
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!arithmixEnabled) {
      return undefined
    }
    let active = true
    load()
      .then((mod) => {
        if (!active) {
          return
        }
        if (!mod) {
          setLoadFailed(true)
          return
        }
        setComponent(() => mod)
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true)
        }
      })
    return () => {
      active = false
    }
  }, [arithmixEnabled, load])

  if (!arithmixEnabled) {
    if (flagsLoaded) {
      notFound()
    }
    return null
  }

  if (loadFailed) {
    notFound()
    return null
  }

  return Component ? <Component {...(componentProps ?? ({} as P))} /> : null
}

export default ArithmixFlagGate
