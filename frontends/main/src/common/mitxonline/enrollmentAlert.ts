import { DASHBOARD_HOME } from "@/common/urls"

/**
 * Query-param constants used by enrollment redirect alerts.
 * The alert component reads these on landing; callsites set them before redirecting.
 */
const ENROLLMENT_SUCCESS_PARAM = "enrollment_success"
const ENROLLMENT_ERROR_PARAM = "enrollment_error"
const ENROLLMENT_ERROR_TYPE_PARAM = "error_type"
const ENROLLMENT_TITLE_PARAM = "enrollment_title"
const ENROLLMENT_ORG_ID_PARAM = "enrollment_org_id"
const ORDER_STATUS_PARAM = "order_status"
const ORDER_ID_PARAM = "order_id"

/**
 * Known enrollment error types. Add new values here as new error scenarios arise.
 */
const EnrollmentErrorType = {
  INVALID_ENROLLMENT_CODE: "invalid-enrollment-code",
} as const

type EnrollmentErrorTypeValue =
  (typeof EnrollmentErrorType)[keyof typeof EnrollmentErrorType]

type EnrollmentAlertSuccessOpts = {
  title: string
  orgId?: number | null
}

/**
 * Build a dashboard URL for frontend-controlled enrollment success redirects
 * (free and B2B flows). Paid flows use backend-provided order_status/order_id params.
 */
const enrollmentAlertSuccessUrl = ({
  title,
  orgId,
}: EnrollmentAlertSuccessOpts) => {
  if (!title) {
    console.error("enrollmentAlertSuccessUrl called with empty title")
  }
  const params = new URLSearchParams()
  params.set(ENROLLMENT_SUCCESS_PARAM, "1")
  params.set(ENROLLMENT_TITLE_PARAM, title)
  if (orgId !== null && orgId !== undefined) {
    params.set(ENROLLMENT_ORG_ID_PARAM, String(orgId))
  }
  return `${DASHBOARD_HOME}?${params.toString()}`
}

const enrollmentAlertErrorUrl = (errorType: EnrollmentErrorTypeValue) => {
  const params = new URLSearchParams()
  params.set(ENROLLMENT_ERROR_PARAM, "1")
  params.set(ENROLLMENT_ERROR_TYPE_PARAM, errorType)
  return `${DASHBOARD_HOME}?${params.toString()}`
}

export {
  enrollmentAlertSuccessUrl,
  enrollmentAlertErrorUrl,
  EnrollmentErrorType,
  ENROLLMENT_SUCCESS_PARAM,
  ENROLLMENT_ERROR_PARAM,
  ENROLLMENT_ERROR_TYPE_PARAM,
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
  ORDER_STATUS_PARAM,
  ORDER_ID_PARAM,
}
export type { EnrollmentAlertSuccessOpts, EnrollmentErrorTypeValue }
