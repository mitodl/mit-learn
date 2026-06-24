import {
  parseUtmParams,
  isGoogleAdTraffic,
  isLinkedInAdTraffic,
  isOrganicSocialTraffic,
} from "./utm"

describe("parseUtmParams", () => {
  it("parses all known UTM params from a query string", () => {
    const search =
      "?utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_term=mit+course&utm_content=ad1&gclid=abc123"
    expect(parseUtmParams(search)).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring",
      utm_term: "mit course",
      utm_content: "ad1",
      gclid: "abc123",
    })
  })

  it("parses from URLSearchParams", () => {
    const params = new URLSearchParams("utm_source=linkedin&li_fat_id=xyz")
    expect(parseUtmParams(params)).toEqual({
      utm_source: "linkedin",
      li_fat_id: "xyz",
    })
  })

  it("omits keys with no value", () => {
    expect(parseUtmParams("utm_source=google")).toEqual({
      utm_source: "google",
    })
  })

  it("returns empty object when no UTM params present", () => {
    expect(parseUtmParams("foo=bar&baz=1")).toEqual({})
  })

  it("ignores unknown params", () => {
    expect(parseUtmParams("utm_source=google&custom_param=x")).toEqual({
      utm_source: "google",
    })
  })
})

describe("isGoogleAdTraffic", () => {
  it("returns true when gclid is present", () => {
    expect(isGoogleAdTraffic({ gclid: "abc123" })).toBe(true)
  })

  it.each(["cpc", "ppc", "paidsearch", "paid"])(
    "returns true for utm_source=google and utm_medium=%s",
    (medium) => {
      expect(
        isGoogleAdTraffic({ utm_source: "google", utm_medium: medium }),
      ).toBe(true)
    },
  )

  it("is case-insensitive for utm_source and utm_medium", () => {
    expect(
      isGoogleAdTraffic({ utm_source: "Google", utm_medium: "CPC" }),
    ).toBe(true)
  })

  it("returns false for utm_source=google with organic medium", () => {
    expect(
      isGoogleAdTraffic({ utm_source: "google", utm_medium: "organic" }),
    ).toBe(false)
  })

  it("returns false for non-Google traffic", () => {
    expect(
      isGoogleAdTraffic({ utm_source: "linkedin", utm_medium: "cpc" }),
    ).toBe(false)
  })

  it("returns false for empty params", () => {
    expect(isGoogleAdTraffic({})).toBe(false)
  })
})

describe("isLinkedInAdTraffic", () => {
  it("returns true when li_fat_id is present", () => {
    expect(isLinkedInAdTraffic({ li_fat_id: "xyz" })).toBe(true)
  })

  it.each(["cpc", "paid", "paid-social", "paidsocial"])(
    "returns true for utm_source=linkedin and utm_medium=%s",
    (medium) => {
      expect(
        isLinkedInAdTraffic({ utm_source: "linkedin", utm_medium: medium }),
      ).toBe(true)
    },
  )

  it("is case-insensitive for utm_source and utm_medium", () => {
    expect(
      isLinkedInAdTraffic({ utm_source: "LinkedIn", utm_medium: "Paid" }),
    ).toBe(true)
  })

  it("returns false for utm_source=linkedin with organic medium", () => {
    expect(
      isLinkedInAdTraffic({ utm_source: "linkedin", utm_medium: "organic" }),
    ).toBe(false)
  })

  it("returns false for non-LinkedIn traffic", () => {
    expect(
      isLinkedInAdTraffic({ utm_source: "google", utm_medium: "paid" }),
    ).toBe(false)
  })

  it("returns false for empty params", () => {
    expect(isLinkedInAdTraffic({})).toBe(false)
  })
})

describe("isOrganicSocialTraffic", () => {
  it.each(["social", "social-organic", "organic-social", "organicsocial"])(
    "returns true for utm_medium=%s",
    (medium) => {
      expect(isOrganicSocialTraffic({ utm_medium: medium })).toBe(true)
    },
  )

  it("is case-insensitive for utm_medium", () => {
    expect(isOrganicSocialTraffic({ utm_medium: "Social" })).toBe(true)
  })

  it("returns true regardless of utm_source", () => {
    expect(
      isOrganicSocialTraffic({ utm_source: "facebook", utm_medium: "social" }),
    ).toBe(true)
  })

  it("returns false for paid social medium", () => {
    expect(isOrganicSocialTraffic({ utm_medium: "paid-social" })).toBe(false)
  })

  it("returns false for organic search", () => {
    expect(
      isOrganicSocialTraffic({ utm_source: "google", utm_medium: "organic" }),
    ).toBe(false)
  })

  it("returns false for empty params", () => {
    expect(isOrganicSocialTraffic({})).toBe(false)
  })
})
