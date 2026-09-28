type UtmParams = {
  /**
   * which platform or site sent the visitor (e.g. Google, a newsletter)
   */
  utm_source?: string
  /**
   * the type of channel used (e.g. email, paid ad, organic social)
   */
  utm_medium?: string
  /**
   * the name of the marketing campaign
   */
  utm_campaign?: string
  /**
   * the paid search keyword that triggered the ad, if applicable
   */
  utm_term?: string
  /**
   * which specific ad or link variant was clicked (for A/B-tested links)
   */
  utm_content?: string
  /**
   * Google's click ID, present when the visit came from a Google Ads click
   */
  gclid?: string
  /**
   * LinkedIn's click ID, present when the visit came from a LinkedIn Ads click
   */
  li_fat_id?: string
}

const UTM_PARAM_KEYS: ReadonlyArray<keyof UtmParams> = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "li_fat_id",
]

const GOOGLE_AD_MEDIUMS = new Set(["cpc", "ppc", "paidsearch", "paid"])
const LINKEDIN_AD_MEDIUMS = new Set([
  "cpc",
  "paid",
  "paid-social",
  "paidsocial",
])
const ORGANIC_SOCIAL_MEDIUMS = new Set([
  "social",
  "social-organic",
  "organic-social",
  "organicsocial",
])

const parseUtmParams = (search: string | URLSearchParams): UtmParams => {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search
  const result: UtmParams = {}
  for (const key of UTM_PARAM_KEYS) {
    const value = params.get(key)
    if (value) result[key] = value
  }
  return result
}

const isGoogleAdTraffic = (params: UtmParams): boolean =>
  Boolean(params.gclid) ||
  (params.utm_source?.toLowerCase() === "google" &&
    GOOGLE_AD_MEDIUMS.has(params.utm_medium?.toLowerCase() ?? ""))

const isLinkedInAdTraffic = (params: UtmParams): boolean =>
  Boolean(params.li_fat_id) ||
  (params.utm_source?.toLowerCase() === "linkedin" &&
    LINKEDIN_AD_MEDIUMS.has(params.utm_medium?.toLowerCase() ?? ""))

const isOrganicSocialTraffic = (params: UtmParams): boolean =>
  ORGANIC_SOCIAL_MEDIUMS.has(params.utm_medium?.toLowerCase() ?? "")

export {
  parseUtmParams,
  isGoogleAdTraffic,
  isLinkedInAdTraffic,
  isOrganicSocialTraffic,
}
export type { UtmParams }
