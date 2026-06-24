import { isGoogleAdTraffic, isLinkedInAdTraffic } from "./utm"
import type { UtmParams } from "./utm"

type DataLayerPayload = Record<string, unknown>

declare global {
  interface Window {
    dataLayer?: DataLayerPayload[]
  }
}

const pushGtmEvent = (event: string, payload: DataLayerPayload = {}) => {
  if (typeof window === "undefined") return

  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      ...payload,
      event,
    })
  } catch {
    // Prevent analytics failures from impacting the app flow.
  }
}

const trackCourseEnrolled = (courseName?: string | null) => {
  pushGtmEvent("course-enrolled", {
    ...(courseName ? { "course-enrolled-name": courseName } : {}),
  })
}

const trackProgramEnrolled = (programName?: string | null) => {
  pushGtmEvent("program-enrolled", {
    ...(programName ? { "program-enrolled-name": programName } : {}),
  })
}

const trackCourseUnenrolled = (courseName?: string | null) => {
  pushGtmEvent("course-unenrolled", {
    ...(courseName
      ? {
          "course-unenrolled-name": courseName,
          // Backward compatibility for any existing GTM variables.
          "course-enrolled-name": courseName,
        }
      : {}),
  })
}

const trackProgramUnenrolled = (programName?: string | null) => {
  pushGtmEvent("program-unenrolled", {
    ...(programName
      ? {
          "program-unenrolled-name": programName,
          // Backward compatibility for any existing GTM variables.
          "program-enrolled-name": programName,
        }
      : {}),
  })
}

const trackGoogleAdArrival = (params: UtmParams) => {
  pushGtmEvent("google-ad-arrival", params)
}

const trackLinkedInAdArrival = (params: UtmParams) => {
  pushGtmEvent("linkedin-ad-arrival", params)
}

const trackAdArrival = (params: UtmParams) => {
  if (isGoogleAdTraffic(params)) {
    trackGoogleAdArrival(params)
  } else if (isLinkedInAdTraffic(params)) {
    trackLinkedInAdArrival(params)
  }
}

/**
 * Fired once per session on the first page load. Includes any UTM params
 * present in the URL so GTM can attribute the arrival to a source/campaign.
 * Maps to "Arrive on Landing Page" in the marketing event plan.
 */
const trackLandingPageArrival = (params: UtmParams = {}) => {
  pushGtmEvent("landing-page-arrival", params)
}

/**
 * Fired when a user visits an individual course page.
 * Maps to "View Course Page" in the marketing event plan.
 */
const trackViewCoursePage = (courseName?: string | null) => {
  pushGtmEvent("view-course-page", {
    ...(courseName ? { "course-name": courseName } : {}),
  })
}

type CourseProgramViewParams = {
  name?: string | null
  id?: string | null
  value?: number | null
  currency?: string | null
}

/**
 * Fired when a course or program detail page is viewed.
 * Populates the `course-program-*` GTM data layer variables used by the
 * "Facebook - view content - microdata" tag.
 */
const trackCourseProgramView = (params: CourseProgramViewParams = {}) => {
  pushGtmEvent("course-program-view", {
    ...(params.name ? { "course-program-name": params.name } : {}),
    ...(params.id ? { "course-program-id": params.id } : {}),
    ...(params.value != null ? { "course-program-value": params.value } : {}),
    ...(params.currency
      ? { "course-program-currency": params.currency }
      : {}),
  })
}

/**
 * Fired when a user submits an email subscription/updates form.
 * Maps to "Sign Up for Updates" in the marketing event plan.
 */
const trackSignUpForUpdates = () => {
  pushGtmEvent("sign-up-for-updates")
}

type AddToCartParams = {
  courseId: string
  courseName?: string | null
  coursePrice?: number | null
}

/**
 * Fired when a user adds a course to the cart.
 * Populates `course-id` and `course-price` GTM data layer variables used by
 * the Facebook add-to-cart and LinkedIn add-to-cart tags.
 */
const trackAddToCart = (params: AddToCartParams) => {
  pushGtmEvent("addToCart", {
    "course-id": params.courseId,
    ...(params.courseName ? { "course-name": params.courseName } : {}),
    "course-price": params.coursePrice ?? 0,
  })
}

/**
 * Fired when a user begins the enrollment or application process.
 * Maps to "Start Enrollment" in the marketing event plan.
 */
const trackStartEnrollment = (courseName?: string | null) => {
  pushGtmEvent("start-enrollment", {
    ...(courseName ? { "course-name": courseName } : {}),
  })
}

/**
 * Fired when a user starts a video.
 * Maps to the "video-start" GTM trigger (trigger id 116).
 */
const trackVideoStart = (videoTitle?: string | null) => {
  pushGtmEvent("video-start", {
    ...(videoTitle ? { "video-title": videoTitle } : {}),
  })
}

/**
 * Fired when a user reaches the 50% mark of a video.
 * Maps to the "video-50-percent" GTM trigger (trigger id 162).
 */
const trackVideo50Percent = (videoTitle?: string | null) => {
  pushGtmEvent("video-50-percent", {
    ...(videoTitle ? { "video-title": videoTitle } : {}),
  })
}

/**
 * Fired when a user performs a site search.
 * Maps to "Search Site" in the marketing event plan.
 */
const trackSiteSearch = (query: string) => {
  pushGtmEvent("site-search", {
    "search-query": query,
  })
}

type CatalogFilterParams = {
  filterName: string
  filterValue: string
}

/**
 * Fired when a user applies a filter to the course catalog.
 * Maps to "Filter Course Catalog" in the marketing event plan.
 */
const trackCatalogFilter = (params: CatalogFilterParams) => {
  pushGtmEvent("catalog-filter", {
    "filter-name": params.filterName,
    "filter-value": params.filterValue,
  })
}

/**
 * Fired once per session when a returning visitor (has visited before) loads the site.
 * Uses localStorage to detect return visitors across sessions.
 * Maps to "Return Visit" in the marketing event plan.
 */
const trackReturnVisit = () => {
  pushGtmEvent("return-visit")
}

/**
 * Fired when a user begins the paid checkout flow.
 * Maps to "Begin Checkout" in the marketing event plan.
 * More specific than trackStartEnrollment — fires only for the checkout path.
 */
const trackBeginCheckout = (courseName?: string | null) => {
  pushGtmEvent("begin-checkout", {
    ...(courseName ? { "course-name": courseName } : {}),
  })
}

/**
 * Fired when a user clicks an organic social share link (Facebook, Twitter, LinkedIn).
 * Maps to "Click on Organic Social Post" in the marketing event plan.
 */
const trackOrganicSocialClick = (platform?: string) => {
  pushGtmEvent("organic-social-click", {
    ...(platform ? { "social-platform": platform } : {}),
  })
}

/**
 * Fired when a user expands a product detail section (About, syllabus, etc.).
 * Maps to "View Program Details" in the marketing event plan.
 */
const trackViewProgramDetails = (sectionName?: string) => {
  pushGtmEvent("view-program-details", {
    ...(sectionName ? { "section-name": sectionName } : {}),
  })
}

type DownloadAssetParams = {
  assetName: string
  assetType?: string
}

/**
 * Fired when a user downloads an asset such as a certificate PDF.
 * Maps to "Download Asset" in the marketing event plan.
 */
const trackDownloadAsset = (params: DownloadAssetParams) => {
  pushGtmEvent("download-asset", {
    "asset-name": params.assetName,
    ...(params.assetType ? { "asset-type": params.assetType } : {}),
  })
}

export {
  pushGtmEvent,
  trackCourseEnrolled,
  trackProgramEnrolled,
  trackCourseUnenrolled,
  trackProgramUnenrolled,
  trackGoogleAdArrival,
  trackLinkedInAdArrival,
  trackAdArrival,
  trackLandingPageArrival,
  trackViewCoursePage,
  trackCourseProgramView,
  trackSignUpForUpdates,
  trackAddToCart,
  trackStartEnrollment,
  trackVideoStart,
  trackVideo50Percent,
  trackSiteSearch,
  trackCatalogFilter,
  trackReturnVisit,
  trackBeginCheckout,
  trackOrganicSocialClick,
  trackViewProgramDetails,
  trackDownloadAsset,
}

export type {
  AddToCartParams,
  CatalogFilterParams,
  CourseProgramViewParams,
  DownloadAssetParams,
}
