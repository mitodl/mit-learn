import { setMockResponse } from "../../test-utils"

/**
 * Answer every enrollment eligibility check (any course run or program) with
 * "may enroll". The paid enrollment path runs this check before the cart.
 *
 * jest-when answers with the first registered mock that matches, so a test
 * that wants a rejection must register its own response instead of (not in
 * addition to) calling this.
 */
const mockEnrollmentEligible = () =>
  setMockResponse.post(
    expect.stringMatching(/\/enrollment-eligible\/$/),
    { enrollable: true, reason_code: null, missing_fields: [] },
    { code: 200 },
  )

export { mockEnrollmentEligible }
