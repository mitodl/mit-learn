import { factories } from "api/analytics-test-utils"
import { DISPLAY_STATUS_LABEL, getDisplayStatus } from "./statusDisplay"

describe("getDisplayStatus", () => {
  test("certified reads Certificate", () => {
    const row = factories.learnerProgress({ completion_status: "certified" })
    expect(getDisplayStatus(row)).toBe("certificate")
  })

  test.each([
    { mode: "verified", expected: "certificate" as const },
    { mode: "audit", expected: "completed" as const },
    // Case shouldn't decide a learner's status.
    { mode: "Verified", expected: "certificate" as const },
  ])("passed in $mode mode reads $expected", ({ mode, expected }) => {
    const row = factories.learnerProgress({
      completion_status: "passed",
      enrollment_mode: mode,
    })
    expect(getDisplayStatus(row)).toBe(expected)
  })

  test("a null enrollment_mode cannot certify", () => {
    const row = factories.learnerProgress({
      completion_status: "passed",
      enrollment_mode: null,
    })
    expect(getDisplayStatus(row)).toBe("completed")
  })

  test.each([
    { status: "in_progress" as const, expected: "in-progress" as const },
    { status: "not_started" as const, expected: "not-started" as const },
  ])("$status reads $expected", ({ status, expected }) => {
    const row = factories.learnerProgress({ completion_status: status })
    expect(getDisplayStatus(row)).toBe(expected)
  })

  test("consent is checked before the status", () => {
    // A row the API should never send — outcomes populated while consent is
    // withheld. Consent still wins, so a query regression upstream cannot
    // leak a status through this function.
    const row = factories.learnerProgress({
      outcomes_shared: false,
      completion_status: "certified",
    })
    expect(getDisplayStatus(row)).toBe("not-shared")
  })

  test("a withheld row reads No consent given", () => {
    expect(getDisplayStatus(factories.withheldLearnerProgress())).toBe(
      "not-shared",
    )
  })

  test("every display status has a label", () => {
    expect(Object.values(DISPLAY_STATUS_LABEL)).toEqual([
      "Not started",
      "In progress",
      "Completed",
      "Certificate",
      "No consent given",
    ])
  })
})
