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
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, "1")
    const isReturnVisit = !!localStorage.getItem(RETURN_VISIT_KEY)
    localStorage.setItem(RETURN_VISIT_KEY, "1")
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
