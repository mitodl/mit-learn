import {
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
} from "./gtm"

beforeEach(() => {
  window.dataLayer = []
})

describe("trackGoogleAdArrival", () => {
  it("pushes a google-ad-arrival event with UTM params", () => {
    const params = {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring",
      gclid: "abc123",
    }
    trackGoogleAdArrival(params)
    expect(window.dataLayer).toContainEqual({
      event: "google-ad-arrival",
      ...params,
    })
  })
})

describe("trackLinkedInAdArrival", () => {
  it("pushes a linkedin-ad-arrival event with UTM params", () => {
    const params = {
      utm_source: "linkedin",
      utm_medium: "paid-social",
      utm_campaign: "spring",
      li_fat_id: "xyz",
    }
    trackLinkedInAdArrival(params)
    expect(window.dataLayer).toContainEqual({
      event: "linkedin-ad-arrival",
      ...params,
    })
  })
})

describe("trackAdArrival", () => {
  it("fires google-ad-arrival for Google Ads traffic (gclid)", () => {
    trackAdArrival({ gclid: "abc123" })
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({ event: "google-ad-arrival" }),
    )
  })

  it("fires google-ad-arrival for Google Ads traffic (utm)", () => {
    trackAdArrival({ utm_source: "google", utm_medium: "cpc" })
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({ event: "google-ad-arrival" }),
    )
  })

  it("fires linkedin-ad-arrival for LinkedIn Ads traffic (li_fat_id)", () => {
    trackAdArrival({ li_fat_id: "xyz" })
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({ event: "linkedin-ad-arrival" }),
    )
  })

  it("fires linkedin-ad-arrival for LinkedIn Ads traffic (utm)", () => {
    trackAdArrival({ utm_source: "linkedin", utm_medium: "paid-social" })
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({ event: "linkedin-ad-arrival" }),
    )
  })

  it("does not push an event for organic traffic", () => {
    const before = (window.dataLayer ?? []).length
    trackAdArrival({ utm_source: "google", utm_medium: "organic" })
    expect((window.dataLayer ?? []).length).toBe(before)
  })

  it("does not push an event for empty params", () => {
    const before = (window.dataLayer ?? []).length
    trackAdArrival({})
    expect((window.dataLayer ?? []).length).toBe(before)
  })
})

describe("trackLandingPageArrival", () => {
  it("pushes a landing-page-arrival event with UTM params", () => {
    const params = { utm_source: "email", utm_campaign: "spring" }
    trackLandingPageArrival(params)
    expect(window.dataLayer).toContainEqual({
      event: "landing-page-arrival",
      ...params,
    })
  })

  it("pushes a landing-page-arrival event with no params", () => {
    trackLandingPageArrival()
    expect(window.dataLayer).toContainEqual({ event: "landing-page-arrival" })
  })
})

describe("trackViewCoursePage", () => {
  it("pushes a view-course-page event with course name", () => {
    trackViewCoursePage("Introduction to Python")
    expect(window.dataLayer).toContainEqual({
      event: "view-course-page",
      "course-name": "Introduction to Python",
    })
  })

  it("pushes a view-course-page event without course name when null", () => {
    trackViewCoursePage(null)
    expect(window.dataLayer).toContainEqual({ event: "view-course-page" })
  })
})

describe("trackCourseProgramView", () => {
  it("pushes a course-program-view event with all fields", () => {
    trackCourseProgramView({
      name: "ML Fundamentals",
      id: "course-v1:MITx+6.86x",
      value: 1500,
      currency: "USD",
    })
    expect(window.dataLayer).toContainEqual({
      event: "course-program-view",
      "course-program-name": "ML Fundamentals",
      "course-program-id": "course-v1:MITx+6.86x",
      "course-program-value": 1500,
      "course-program-currency": "USD",
    })
  })

  it("omits undefined optional fields", () => {
    trackCourseProgramView({ name: "ML Fundamentals" })
    expect(window.dataLayer).toContainEqual({
      event: "course-program-view",
      "course-program-name": "ML Fundamentals",
    })
  })

  it("pushes a course-program-view event with no params", () => {
    trackCourseProgramView()
    expect(window.dataLayer).toContainEqual({ event: "course-program-view" })
  })
})

describe("trackSignUpForUpdates", () => {
  it("pushes a sign-up-for-updates event", () => {
    trackSignUpForUpdates()
    expect(window.dataLayer).toContainEqual({ event: "sign-up-for-updates" })
  })
})

describe("trackAddToCart", () => {
  it("pushes an addToCart event with all fields", () => {
    trackAddToCart({
      courseId: "course-v1:MITx+6.86x",
      courseName: "Machine Learning",
      coursePrice: 1500,
    })
    expect(window.dataLayer).toContainEqual({
      event: "addToCart",
      "course-id": "course-v1:MITx+6.86x",
      "course-name": "Machine Learning",
      "course-price": 1500,
    })
  })

  it("defaults course-price to 0 when not provided", () => {
    trackAddToCart({ courseId: "course-v1:MITx+6.86x" })
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({
        event: "addToCart",
        "course-price": 0,
      }),
    )
  })
})

describe("trackStartEnrollment", () => {
  it("pushes a start-enrollment event with course name", () => {
    trackStartEnrollment("Python for Data Science")
    expect(window.dataLayer).toContainEqual({
      event: "start-enrollment",
      "course-name": "Python for Data Science",
    })
  })

  it("pushes a start-enrollment event without course name when null", () => {
    trackStartEnrollment(null)
    expect(window.dataLayer).toContainEqual({ event: "start-enrollment" })
  })
})

describe("trackVideoStart", () => {
  it("pushes a video-start event with video title", () => {
    trackVideoStart("Introduction to Python")
    expect(window.dataLayer).toContainEqual({
      event: "video-start",
      "video-title": "Introduction to Python",
    })
  })

  it("pushes a video-start event without title when null", () => {
    trackVideoStart(null)
    expect(window.dataLayer).toContainEqual({ event: "video-start" })
  })
})

describe("trackVideo50Percent", () => {
  it("pushes a video-50-percent event with video title", () => {
    trackVideo50Percent("Introduction to Python")
    expect(window.dataLayer).toContainEqual({
      event: "video-50-percent",
      "video-title": "Introduction to Python",
    })
  })

  it("pushes a video-50-percent event without title when not provided", () => {
    trackVideo50Percent()
    expect(window.dataLayer).toContainEqual({ event: "video-50-percent" })
  })
})

describe("trackSiteSearch", () => {
  it("pushes a site-search event with the search query", () => {
    trackSiteSearch("machine learning")
    expect(window.dataLayer).toContainEqual({
      event: "site-search",
      "search-query": "machine learning",
    })
  })
})

describe("trackCatalogFilter", () => {
  it("pushes a catalog-filter event with filter name and value", () => {
    trackCatalogFilter({ filterName: "topic", filterValue: "data science" })
    expect(window.dataLayer).toContainEqual({
      event: "catalog-filter",
      "filter-name": "topic",
      "filter-value": "data science",
    })
  })
})

describe("trackReturnVisit", () => {
  it("pushes a return-visit event", () => {
    trackReturnVisit()
    expect(window.dataLayer).toContainEqual({ event: "return-visit" })
  })
})

describe("trackBeginCheckout", () => {
  it("pushes a begin-checkout event with course name", () => {
    trackBeginCheckout("Data Science Fundamentals")
    expect(window.dataLayer).toContainEqual({
      event: "begin-checkout",
      "course-name": "Data Science Fundamentals",
    })
  })

  it("pushes a begin-checkout event without course name when null", () => {
    trackBeginCheckout(null)
    expect(window.dataLayer).toContainEqual({ event: "begin-checkout" })
  })
})

describe("trackOrganicSocialClick", () => {
  it("pushes an organic-social-click event with platform", () => {
    trackOrganicSocialClick("Facebook")
    expect(window.dataLayer).toContainEqual({
      event: "organic-social-click",
      "social-platform": "Facebook",
    })
  })

  it("pushes an organic-social-click event without platform when not provided", () => {
    trackOrganicSocialClick()
    expect(window.dataLayer).toContainEqual({ event: "organic-social-click" })
  })
})

describe("trackViewProgramDetails", () => {
  it("pushes a view-program-details event with section name", () => {
    trackViewProgramDetails("About")
    expect(window.dataLayer).toContainEqual({
      event: "view-program-details",
      "section-name": "About",
    })
  })

  it("pushes a view-program-details event without section name when not provided", () => {
    trackViewProgramDetails()
    expect(window.dataLayer).toContainEqual({ event: "view-program-details" })
  })
})
