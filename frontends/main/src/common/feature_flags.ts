import { env, fullEnv } from "@/env"

// Feature flags for the app. These should correspond to the flag that's set up
// in PostHog.

export enum FeatureFlags {
  LrDrawerChatbot = "lr-drawer-chatbot",
  PrDrawerChatbot = "pr-drawer-chatbot",
  RecommendationBot = "recommendation-bot",
  HomePageRecommendationBot = "home-page-recommendation-bot",
  UniversalAI = "universal-ai",
  UniversalAISearchBanner = "universal-ai-search-banner",
  CourseOutlineSection = "course-outline-section",
  OcwProductPages = "ocw-product-pages",
  VideoPlaylistPage = "video-playlist-page",
  B2BLearnerAnalytics = "b2b-learner-analytics",
  SelfServiceRefunds = "self-service-refunds",
  DisableHybridSearch = "disable-hybrid-search",
  DepartmentPageRedesign = "department-page-redesign",
  ContactUs = "contact-us",
  EducatorPage = "educator-page",
  CyberSaleBanner = "cyber-sale-banner",
}

/** Flag values the Next.js server evaluated for this document. */
export type ServerFlags = Partial<Record<FeatureFlags, boolean>>

/**
 * The flag's env default: `NEXT_PUBLIC_FEATURE_<flag>`, with dashes in the
 * flag key read as underscores in the env var name. Only "true" (any case) is
 * on; anything else, including unset, is off.
 */
const flagDefault = (flag: FeatureFlags): boolean => {
  const prefix = env("NEXT_PUBLIC_POSTHOG_FEATURE_PREFIX") ?? "FEATURE_"
  /**
   * fullEnv(), not env(): these keys are built at runtime, and env() only
   * accepts the keys declared in the env schema.
   */
  const value = fullEnv()[`NEXT_PUBLIC_${prefix}${flag.replaceAll("-", "_")}`]
  return value?.toLowerCase() === "true"
}

/**
 * The value a flag renders with on the server and during hydration: the
 * server's value, then the flag's env default.
 */
export const flagFallback = (
  flag: FeatureFlags,
  serverFlags: ServerFlags,
): boolean => serverFlags[flag] ?? flagDefault(flag)
