import {
  trackLandingPageArrival,
  trackAdArrival,
  trackReturnVisit,
  trackOrganicSocialClick,
  trackViewCoursePage,
  trackCourseProgramView,
  trackViewProgramDetails,
  trackStartEnrollment,
  trackBeginCheckout,
  trackAddToCart,
  trackCourseEnrolled,
  trackProgramEnrolled,
  trackCourseUnenrolled,
  trackProgramUnenrolled,
  trackCheckoutCompleted,
  trackAccountCreated,
  trackSignUpForUpdates,
  trackVideoStart,
  trackVideo50Percent,
  trackSiteSearch,
  trackFilterCourseCatalog,
} from "./gtm"
import type {
  AddToCartParams,
  BeginCheckoutParams,
  CourseProgramViewParams,
  CheckoutCompletedParams,
  CatalogFilterParams,
} from "./gtm"
import type { UtmParams } from "./utm"

const analytics = {
  // Session / arrival
  landingPageArrived: (params?: UtmParams) => trackLandingPageArrival(params),
  adArrived: (params: UtmParams) => trackAdArrival(params),
  returnVisitDetected: () => trackReturnVisit(),
  organicSocialClicked: (platform?: string) =>
    trackOrganicSocialClick(platform),

  // Course / program pages
  coursePageViewed: (courseName?: string | null) =>
    trackViewCoursePage(courseName),
  courseProgramViewed: (params?: CourseProgramViewParams) =>
    trackCourseProgramView(params),
  programDetailsSectionExpanded: (sectionName?: string) =>
    trackViewProgramDetails(sectionName),

  // Enrollment
  enrollmentStarted: (courseName?: string | null) =>
    trackStartEnrollment(courseName),
  checkoutStarted: (params: BeginCheckoutParams) =>
    trackBeginCheckout(params),
  addedToCart: (params: AddToCartParams) => trackAddToCart(params),
  courseEnrolled: (courseName?: string | null) =>
    trackCourseEnrolled(courseName),
  programEnrolled: (programName?: string | null) =>
    trackProgramEnrolled(programName),
  courseUnenrolled: (courseName?: string | null) =>
    trackCourseUnenrolled(courseName),
  programUnenrolled: (programName?: string | null) =>
    trackProgramUnenrolled(programName),
  checkoutCompleted: (params: CheckoutCompletedParams) =>
    trackCheckoutCompleted(params),

  // Account
  accountCreated: () => trackAccountCreated(),
  signedUpForUpdates: () => trackSignUpForUpdates(),

  // Video
  videoStarted: (videoTitle?: string | null) => trackVideoStart(videoTitle),
  videoReachedHalfway: (videoTitle?: string | null) =>
    trackVideo50Percent(videoTitle),

  // Search
  siteSearched: (query: string) => trackSiteSearch(query),
  catalogFiltered: (params: CatalogFilterParams) =>
    trackFilterCourseCatalog(params),
}

export { analytics }
export type { UtmParams }
