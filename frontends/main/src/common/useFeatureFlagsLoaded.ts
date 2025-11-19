import { usePostHog } from "posthog-js/react"
import { useState, useEffect } from "react"

const useFeatureFlagsLoaded = () => {
  const posthog = usePostHog()
  const [hasLoaded, setHasLoaded] = useState(
    posthog.featureFlags.hasLoadedFlags,
  )
  useEffect(() => {
    posthog.onFeatureFlags(() => {
      setHasLoaded(true)
    })
  }, [posthog])
  return hasLoaded
}

export { useFeatureFlagsLoaded }
