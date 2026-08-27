import { env } from "@/env"
export const getRecaptchaSiteKey = (): string | undefined =>
  (env("NEXT_PUBLIC_RECAPTCHA_SITE_KEY") ?? "").trim() || undefined

export const getStayUpdatedHubspotFormId = (): string =>
  (env("NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID") ?? "").trim()

export const getOrgLearningHubspotFormId = (): string =>
  (env("NEXT_PUBLIC_ORG_LEARNING_HUBSPOT_FORM_ID") ?? "").trim()

/** CDN TTL used when NEXT_PUBLIC_CACHE_S_MAXAGE_SECONDS is unset: local dev and CI. */
const DEFAULT_S_MAXAGE_SECONDS = 1800

/**
 * The CDN TTL for HTML page responses, in seconds.
 *
 * Two readers must agree on this value: proxy.ts sends it as the Cache-Control
 * s-maxage, and getQueryClient.ts uses it as the browser React Query staleTime,
 * so that CDN-cached HTML does not hydrate into queries that are already stale
 * and refetch immediately — which shows up as flicker on unstable endpoints
 * (e.g. the intentionally randomized featured learning resources).
 *
 * Matching them is a floor, not a guarantee: the same header sends
 * stale-while-revalidate=86400, so an edge can serve HTML older than s-maxage.
 * Refetching on hydration is the right outcome there.
 */
export const getCacheSMaxageSeconds = (): number => {
  // Same /^\d+$/ as validateEnv.js: rejects unset and the "" ol-infrastructure
  // sends when the Pulumi config key is absent, while keeping an explicit "0".
  const configured = env("NEXT_PUBLIC_CACHE_S_MAXAGE_SECONDS") ?? ""
  return /^\d+$/.test(configured)
    ? Number(configured)
    : DEFAULT_S_MAXAGE_SECONDS
}
