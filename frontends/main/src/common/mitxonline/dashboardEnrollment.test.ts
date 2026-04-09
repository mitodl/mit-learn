import {
  ENROLLMENT_SUCCESS_QUERY_PARAM,
  clearDashboardEnrollmentStorage,
  dashboardEnrollmentSuccessUrl,
  readDashboardEnrollmentStorage,
  storeDashboardEnrollmentStorage,
} from "./dashboardEnrollment"

describe("dashboardEnrollment", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  test("stores title and optional org id for dashboard success copy", () => {
    storeDashboardEnrollmentStorage({ title: "Data Science", orgId: 42 })

    expect(readDashboardEnrollmentStorage()).toEqual({
      title: "Data Science",
      orgId: 42,
    })
  })

  test("stores title without org id when omitted", () => {
    storeDashboardEnrollmentStorage({ title: "Data Science" })

    expect(readDashboardEnrollmentStorage()).toEqual({
      title: "Data Science",
      orgId: null,
    })
  })

  test("clears stored success copy", () => {
    storeDashboardEnrollmentStorage({
      title: "Signals and Systems",
      orgId: null,
    })
    clearDashboardEnrollmentStorage()

    expect(readDashboardEnrollmentStorage()).toBeNull()
  })

  test("builds the dashboard success URL", () => {
    expect(ENROLLMENT_SUCCESS_QUERY_PARAM).toBe("enrollment_success")
    expect(dashboardEnrollmentSuccessUrl()).toBe(
      "/dashboard?enrollment_success=1",
    )
  })
})
