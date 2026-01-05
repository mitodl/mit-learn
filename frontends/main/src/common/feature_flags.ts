// Feature flags for the app. These should correspond to the flag that's set up
// in PostHog.

export enum FeatureFlags {
  EnableEcommerce = "enable-ecommerce",
  LrDrawerChatbot = "lr-drawer-chatbot",
  PrDrawerChatbot = "pr-drawer-chatbot",
  RecommendationBot = "recommendation-bot",
  HomePageRecommendationBot = "home-page-recommendation-bot",
  EnrollmentDashboard = "enrollment-dashboard",
  VideoShorts = "video-shorts",
  MitxOnlineProductPages = "mitxonline-product-pages",
  ArticleEditorView = "article-editor-view",
}

/**
 * A special flag that indicates feature flags are in their bootstrapped state,
 * not yet loaded from PostHog server.
 *
 * DO NOT add this flag to PostHog!
 */
export const INTERNAL_BOOTSTRAPPING_FLAG =
  "__flags_are_bootstrapped_do_not_add_this_to_posthog__"
