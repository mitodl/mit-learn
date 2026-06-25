"use client"

import React, { useEffect } from "react"
import ConfiguredPostHogProvider from "@/page-components/ConfiguredPostHogProvider/ConfiguredPostHogProvider"
import {
  trackLandingPageArrival,
  trackAdArrival,
  trackReturnVisit,
  trackOrganicSocialClick,
} from "@/common/analytics/gtm"
import { parseUtmParams, isOrganicSocialTraffic } from "@/common/analytics/utm"

const SESSION_KEY = "gtm_landing_page_tracked"
const RETURN_VISIT_KEY = "gtm_has_visited"

function AnalyticsTracker() {
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
    trackLandingPageArrival(utmParams)
    trackAdArrival(utmParams)
    if (isOrganicSocialTraffic(utmParams)) {
      trackOrganicSocialClick(utmParams.utm_source)
    }
    if (isReturnVisit) {
      trackReturnVisit()
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
