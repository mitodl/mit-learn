export const getRecaptchaSiteKey = (): string | undefined =>
  (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "").trim() || undefined

export const getStayUpdatedHubspotFormId = (): string =>
  (process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID ?? "").trim()
