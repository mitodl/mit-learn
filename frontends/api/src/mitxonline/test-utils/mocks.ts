import { setMockResponse } from "../../test-utils"

/**
 * Answer every enrollment eligibility check (any course run or program) with
 * "may enroll". The paid enrollment path runs this check before the cart; a
 * test that wants a rejection registers a response for the specific URL,
 * which takes precedence.
 */
const mockEnrollmentEligible = () =>
  setMockResponse.post(
    expect.stringMatching(/\/enrollment-eligible\/$/),
    { enrollable: true, reason_code: null, missing_fields: [] },
    { code: 200 },
  )

export { mockEnrollmentEligible }
