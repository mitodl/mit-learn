import {
  ENROLLMENT_STATUS_PARAM,
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
  EnrollmentErrorType,
  enrollmentAlertSuccessUrl,
  enrollmentAlertErrorUrl,
} from "./enrollmentAlert"

describe("enrollmentAlert", () => {
  test("builds a success URL with enrollment_status=success and title", () => {
    const url = enrollmentAlertSuccessUrl({ title: "Data Science" })
    expect(url).toBe(
      "/dashboard?enrollment_status=success&enrollment_title=Data+Science",
    )
  })

  test("includes org id when provided", () => {
    const url = enrollmentAlertSuccessUrl({
      title: "Professional Certificate",
      orgId: 77,
    })
    expect(url).toBe(
      "/dashboard?enrollment_status=success&enrollment_title=Professional+Certificate&enrollment_org_id=77",
    )
  })

  test("omits org id param when orgId is null or undefined", () => {
    const urlNull = enrollmentAlertSuccessUrl({
      title: "Signals",
      orgId: null,
    })
    const urlOmitted = enrollmentAlertSuccessUrl({ title: "Signals" })
    expect(urlNull).toBe(
      "/dashboard?enrollment_status=success&enrollment_title=Signals",
    )
    expect(urlOmitted).toBe(
      "/dashboard?enrollment_status=success&enrollment_title=Signals",
    )
  })

  test("builds an error URL with enrollment_status=error and error type", () => {
    expect(
      enrollmentAlertErrorUrl(EnrollmentErrorType.INVALID_ENROLLMENT_CODE),
    ).toBe(
      "/dashboard?enrollment_status=error&error_type=invalid-enrollment-code",
    )
  })

  test("exports the expected param name constants", () => {
    expect(ENROLLMENT_STATUS_PARAM).toBe("enrollment_status")
    expect(ENROLLMENT_TITLE_PARAM).toBe("enrollment_title")
    expect(ENROLLMENT_ORG_ID_PARAM).toBe("enrollment_org_id")
  })
})
