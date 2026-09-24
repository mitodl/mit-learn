import { factories } from "api/analytics-test-utils"
import type { CompletionStatus } from "api/analytics-hooks/organizations"
import { DISPLAY_STATUS_LABEL, getDisplayStatus } from "./statusDisplay"

describe("getDisplayStatus", () => {
  test("certified reads Certificate", () => {
    const row = factories.learnerProgress({ completion_status: "certified" })
    expect(getDisplayStatus(row)).toBe("certificate")
  })

  test.each(["verified", "audit", "Verified", null])(
    "passed reads Completed regardless of enrollment_mode (%s)",
    (mode) => {
      const row = factories.learnerProgress({
        completion_status: "passed",
        enrollment_mode: mode,
      })
      expect(getDisplayStatus(row)).toBe("completed")
    },
  )

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

  test("a consenting row with an unrecognized completion_status reads Unknown, not No consent given", () => {
    // A value outside the four known statuses — e.g. one the API added after
    // this union was written. Consent was given, so this must not collapse
    // into the withheld-consent state.
    const row = factories.learnerProgress({
      outcomes_shared: true,
      completion_status: "some_future_status" as unknown as CompletionStatus,
    })
    expect(getDisplayStatus(row)).toBe("unknown")
  })

  test("every display status has a label", () => {
    expect(Object.values(DISPLAY_STATUS_LABEL)).toEqual([
      "Not started",
      "In progress",
      "Completed",
      "Certificate",
      "No consent given",
      "Unknown",
    ])
  })
})
