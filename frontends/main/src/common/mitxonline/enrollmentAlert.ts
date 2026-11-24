import { DASHBOARD_HOME } from "@/common/urls"

/**
 * Query-param constants used by enrollment redirect alerts.
 * The alert component reads these on landing; callsites set them before redirecting.
 */
const ENROLLMENT_STATUS_PARAM = "enrollment_status"
const ENROLLMENT_ERROR_TYPE_PARAM = "error_type"
const ENROLLMENT_TITLE_PARAM = "enrollment_title"
const ENROLLMENT_ORG_ID_PARAM = "enrollment_org_id"
const ORDER_STATUS_PARAM = "order_status"
const ORDER_ID_PARAM = "order_id"

const EnrollmentAlertStatus = {
  SUCCESS: "success",
  ERROR: "error",
} as const

/**
 * Known enrollment error types. Add new values here as new error scenarios arise.
 *
 * Values other than INVALID_ENROLLMENT_CODE match MITx Online's user message
 * types (`USER_MSG_TYPE_*` in mitxonline's `main/constants.py`). MITx Online
 * passes them as `error_type` when it redirects a learner to the Learn
 * dashboard after an enrollment or checkout error, since Learn can't read the
 * `user-message` cookie MITx Online sets for its own pages.
 */
const EnrollmentErrorType = {
  INVALID_ENROLLMENT_CODE: "invalid-enrollment-code",
  ENROLL_FAILED: "enroll-failed",
  ENROLL_BLOCKED: "enroll-blocked",
  ENROLL_DUPLICATED: "enroll-duplicated",
  PAYMENT_ERROR_UNKNOWN: "payment-error-unknown",
} as const

/**
 * Order states MITx Online can pass as `order_status` when it redirects a
 * learner to the Learn dashboard after checkout. These match mitxonline's
 * `OrderStatus` values. A Stripe checkout returns the learner before the
 * payment webhook arrives, so the order is usually still pending.
 */
const OrderAlertStatus = {
  FULFILLED: "fulfilled",
  PENDING: "pending",
  REVIEW: "review",
  DECLINED: "declined",
  ERRORED: "errored",
  CANCELED: "canceled",
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
  params.set(ENROLLMENT_STATUS_PARAM, EnrollmentAlertStatus.SUCCESS)
  params.set(ENROLLMENT_TITLE_PARAM, title)
  if (orgId !== null && orgId !== undefined) {
    params.set(ENROLLMENT_ORG_ID_PARAM, String(orgId))
  }
  return `${DASHBOARD_HOME}?${params.toString()}`
}

const enrollmentAlertErrorUrl = (errorType: EnrollmentErrorTypeValue) => {
  const params = new URLSearchParams()
  params.set(ENROLLMENT_STATUS_PARAM, EnrollmentAlertStatus.ERROR)
  params.set(ENROLLMENT_ERROR_TYPE_PARAM, errorType)
  return `${DASHBOARD_HOME}?${params.toString()}`
}

export {
  enrollmentAlertSuccessUrl,
  enrollmentAlertErrorUrl,
  EnrollmentAlertStatus,
  EnrollmentErrorType,
  OrderAlertStatus,
  ENROLLMENT_STATUS_PARAM,
  ENROLLMENT_ERROR_TYPE_PARAM,
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
  ORDER_STATUS_PARAM,
  ORDER_ID_PARAM,
}
export type { EnrollmentAlertSuccessOpts, EnrollmentErrorTypeValue }
