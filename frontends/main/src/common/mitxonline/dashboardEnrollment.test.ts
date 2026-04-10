import {
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
  dashboardEnrollmentSuccessUrl,
} from "./dashboardEnrollment"

describe("dashboardEnrollment", () => {
  test("builds a dashboard success URL with the enrollment title", () => {
    const url = dashboardEnrollmentSuccessUrl({ title: "Data Science" })
    expect(url).toBe("/dashboard?enrollment_title=Data+Science")
  })

  test("includes org id when provided", () => {
    const url = dashboardEnrollmentSuccessUrl({
      title: "Professional Certificate",
      orgId: 77,
    })
    expect(url).toBe(
      "/dashboard?enrollment_title=Professional+Certificate&enrollment_org_id=77",
    )
  })

  test("omits org id param when orgId is null or undefined", () => {
    const urlNull = dashboardEnrollmentSuccessUrl({
      title: "Signals",
      orgId: null,
    })
    const urlOmitted = dashboardEnrollmentSuccessUrl({ title: "Signals" })
    expect(urlNull).toBe("/dashboard?enrollment_title=Signals")
    expect(urlOmitted).toBe("/dashboard?enrollment_title=Signals")
  })

  test("exports the expected param name constants", () => {
    expect(ENROLLMENT_TITLE_PARAM).toBe("enrollment_title")
    expect(ENROLLMENT_ORG_ID_PARAM).toBe("enrollment_org_id")
  })
})
