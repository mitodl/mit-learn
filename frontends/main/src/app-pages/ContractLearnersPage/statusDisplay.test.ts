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

  test.each(["declined", "not_recorded"] as const)(
    "a withheld row reads Unknown, even with a status (%s)",
    (consent) => {
      const row = factories.learnerProgress({
        outcomes_consent_status: consent,
        outcomes_shared: false,
        completion_status: "certified",
      })
      expect(getDisplayStatus(row)).toBe("unknown")
    },
  )

  test("a row shared under consent_fail_open shows its status", () => {
    const row = factories.learnerProgress({
      outcomes_consent_status: "not_recorded",
      outcomes_shared: true,
      completion_status: "certified",
    })
    expect(getDisplayStatus(row)).toBe("certificate")
  })

  test("a consenting row with an unrecognized completion_status reads Unknown", () => {
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
      "Unknown",
    ])
  })
})
