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
import { capturePostHog, initPostHog } from "./posthog"
import { PostHogEvents } from "@/common/constants"

type EnrollCtaClickedParams = {
  placement: "header" | "infobox" | undefined
  enrollmentMode: "verified" | "audit"
  resourceType: "course" | "program"
  readableId: string
  label: string
}

type ResourceViewedParams = {
  resourceId?: number
  readableId?: string | null
  platformCode?: string | null
  resourceType?: string
}

type ResourceAddedToListParams = {
  listType: string
  resourceId?: number
  readableId?: string | null
  platformCode?: string | null
  resourceType?: string
}

type CourseCardClickedParams = {
  label?: string | null
  resourceId?: number
  readableId?: string | null
  resourceType?: string
  platformCode?: string | null
  position?: number
}

type AskTimClickedParams = {
  type: string
  resourceId?: number
  readableId?: string | null
  resourceType?: string
  platformCode?: string | null
}

type VideoShortOpenedParams = {
  videoId: number
  videoTitle: string
  position: number
}

type VideoShortViewedParams = {
  videoId: number
  videoTitle: string
  timeOnVideoMs?: number
  videoDurationMs?: number
}

type VideoShortsClosedParams = {
  sessionDurationMs: number
  totalVideosViewed: number
}

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

  // Enrollment (GTM)
  enrollmentStarted: (courseName?: string | null) =>
    trackStartEnrollment(courseName),
  checkoutStarted: (params: BeginCheckoutParams) => trackBeginCheckout(params),
  addedToCart: (params: AddToCartParams) => trackAddToCart(params),
  courseEnrolled: (courseName?: string | null) =>
    trackCourseEnrolled(courseName),
  programEnrolled: (programName?: string | null) =>
    trackProgramEnrolled(programName),
  courseUnenrolled: (courseName?: string | null) =>
    trackCourseUnenrolled(courseName),
  programUnenrolled: (programName?: string | null) =>
    trackProgramUnenrolled(programName),
  checkoutCompleted: (
    params: CheckoutCompletedParams & {
      readableId?: string
      contentType?: string | null
    },
  ) => {
    trackCheckoutCompleted(params)
    capturePostHog(PostHogEvents.CheckoutCompleted, {
      orderId: params.orderId,
      courseName: params.courseName,
      value: params.value,
      readableId: params.readableId,
      contentType: params.contentType,
    })
  },

  // Enrollment CTA (PostHog)
  enrollCtaClicked: (params: EnrollCtaClickedParams) =>
    capturePostHog(PostHogEvents.EnrollCtaClicked, {
      ...params,
      platform: "mitxonline",
    }),

  // Account
  accountCreated: () => trackAccountCreated(),
  signedUpForUpdates: () => trackSignUpForUpdates(),

  // Video (GTM)
  videoStarted: (videoTitle?: string | null) => trackVideoStart(videoTitle),
  videoReachedHalfway: (videoTitle?: string | null) =>
    trackVideo50Percent(videoTitle),

  // Video Shorts (PostHog)
  videoShortOpened: (params: VideoShortOpenedParams) =>
    capturePostHog(PostHogEvents.VideoShortsOpened, params),
  videoShortViewed: (params: VideoShortViewedParams) =>
    capturePostHog(PostHogEvents.VideoShortViewed, params),
  videoShortsClosed: (params: VideoShortsClosedParams) =>
    capturePostHog(PostHogEvents.VideoShortsClosed, params),

  // Search (GTM + PostHog)
  siteSearched: (params: { query: string; isEnter?: boolean }) => {
    trackSiteSearch(params.query)
    capturePostHog(PostHogEvents.SearchUpdate, {
      search_term: params.query,
      isEnter: params.isEnter,
    })
  },
  catalogFiltered: (params: CatalogFilterParams) =>
    trackFilterCourseCatalog(params),
  searchFilterChanged: (params: { control: string }) =>
    capturePostHog(PostHogEvents.SearchFilterUpdate, params),

  // Resource drawer (PostHog)
  resourceViewed: (params: ResourceViewedParams) =>
    capturePostHog(PostHogEvents.LearningResourceDrawerView, params),
  resourceDrawerOpened: (params: { resource: unknown }) =>
    capturePostHog(PostHogEvents.LearningResourceDrawerOpen, params),

  // Lists (PostHog)
  resourceAddedToList: (params: ResourceAddedToListParams) =>
    capturePostHog(PostHogEvents.LRAddToList, params),

  // Resource cards (PostHog)
  courseCardClicked: (params: CourseCardClickedParams) =>
    capturePostHog(PostHogEvents.CourseCardClicked, params),

  // Topics (PostHog)
  homeTopicClicked: (params: { topic: string }) =>
    capturePostHog(PostHogEvents.HomeTopicClicked, params),
  homeSeeAllTopicsClicked: () =>
    capturePostHog(PostHogEvents.HomeSeeAllTopicsClicked),
  topicClicked: (params: { topic: string }) =>
    capturePostHog(PostHogEvents.TopicClicked, params),
  subTopicClicked: (params: { topic: string }) =>
    capturePostHog(PostHogEvents.SubTopicClicked, params),
  relatedTopicClicked: (params: { topic: string }) =>
    capturePostHog(PostHogEvents.RelatedTopicClicked, params),

  // Departments / providers (PostHog)
  departmentLinkClicked: (params: { department: unknown }) =>
    capturePostHog(PostHogEvents.DepartmentLinkClicked, params),
  providerLinkClicked: (params: { provider: unknown }) =>
    capturePostHog(PostHogEvents.ProviderLinkClicked, params),

  // AskTim (PostHog)
  askTimClicked: (params: AskTimClickedParams) =>
    capturePostHog(PostHogEvents.AskTimClicked, params),
  searchAiOverviewDismissed: () =>
    capturePostHog(PostHogEvents.SearchAiOverviewDismissed),

  // Org learning (PostHog)
  orgLearningCtaClicked: (params: { placement: string }) =>
    capturePostHog(PostHogEvents.OrgLearningCtaClicked, params),
  orgLearningAudienceSelected: (params: { audience: string }) =>
    capturePostHog(PostHogEvents.OrgLearningAudienceSelected, params),
  orgLearningFormSubmitted: (params: { audience: string }) =>
    capturePostHog(PostHogEvents.OrgLearningFormSubmitted, params),

  // Generic CTA (PostHog)
  ctaClicked: (params: Record<string, unknown>) =>
    capturePostHog(PostHogEvents.CallToActionClicked, params),

  // Navigation (PostHog)
  navDrawerToggled: (willOpen: boolean) =>
    capturePostHog(
      willOpen ? PostHogEvents.OpenedNavDrawer : PostHogEvents.ClosedNavDrawer,
    ),
  navItemClicked: (event: string, properties?: Record<string, unknown>) =>
    capturePostHog(event, properties),

  // Hero (PostHog)
  heroBrowseTopicsClicked: () =>
    capturePostHog(PostHogEvents.HeroBrowseTopics),
}

export { analytics, initPostHog }
export type { UtmParams }
