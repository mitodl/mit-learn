"use client"

import React, { useEffect } from "react"
import ConfiguredPostHogProvider from "@/page-components/ConfiguredPostHogProvider/ConfiguredPostHogProvider"
import { analytics, initPostHog } from "@/common/analytics"
import { parseUtmParams, isOrganicSocialTraffic } from "@/common/analytics/utm"
import { usePostHog } from "posthog-js/react"

const SESSION_KEY = "gtm_landing_page_tracked"
const RETURN_VISIT_KEY = "gtm_has_visited"

function AnalyticsTracker() {
  const posthog = usePostHog()
  initPostHog(posthog)

  useEffect(() => {
    let alreadyTracked = false
    let isReturnVisit = false

    try {
      alreadyTracked = Boolean(sessionStorage.getItem(SESSION_KEY))
      if (!alreadyTracked) {
        sessionStorage.setItem(SESSION_KEY, "1")
        isReturnVisit = Boolean(localStorage.getItem(RETURN_VISIT_KEY))
        localStorage.setItem(RETURN_VISIT_KEY, "1")
      }
    } catch {
      // Storage may be unavailable; fall back to tracking without persistence.
    }

    if (alreadyTracked) return

    const utmParams = parseUtmParams(window.location.search)
    analytics.landingPageArrived(utmParams)
    analytics.adArrived(utmParams)
    if (isOrganicSocialTraffic(utmParams)) {
      analytics.organicSocialClicked(utmParams.utm_source)
    }
    if (isReturnVisit) {
      analytics.returnVisitDetected()
    }
  }, [])
  return null
}

export default function SiteProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConfiguredPostHogProvider>
      <AnalyticsTracker />
      {children}
    </ConfiguredPostHogProvider>
  )
}
