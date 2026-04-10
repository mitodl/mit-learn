import { DASHBOARD_HOME } from "@/common/urls"

/**
 * Query-param constants used by enrollment redirect alerts.
 * The alert component reads these on landing; callsites set them before redirecting.
 */
const ENROLLMENT_ERROR_PARAM = "enrollment_error"
const ENROLLMENT_TITLE_PARAM = "enrollment_title"
const ENROLLMENT_ORG_ID_PARAM = "enrollment_org_id"
const ORDER_STATUS_PARAM = "order_status"
const ORDER_ID_PARAM = "order_id"

type EnrollmentAlertSuccessOpts = {
  title: string
  orgId?: number | null
}

const enrollmentAlertSuccessUrl = ({
  title,
  orgId,
}: EnrollmentAlertSuccessOpts) => {
  const params = new URLSearchParams()
  params.set(ENROLLMENT_TITLE_PARAM, title)
  if (orgId !== null && orgId !== undefined) {
    params.set(ENROLLMENT_ORG_ID_PARAM, String(orgId))
  }
  return `${DASHBOARD_HOME}?${params.toString()}`
}

const enrollmentAlertErrorUrl = () =>
  `${DASHBOARD_HOME}?${ENROLLMENT_ERROR_PARAM}=1`

export {
  enrollmentAlertSuccessUrl,
  enrollmentAlertErrorUrl,
  ENROLLMENT_ERROR_PARAM,
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
  ORDER_STATUS_PARAM,
  ORDER_ID_PARAM,
}
export type { EnrollmentAlertSuccessOpts }
