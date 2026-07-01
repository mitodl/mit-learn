type UtmParams = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  gclid?: string
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
