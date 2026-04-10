import { DASHBOARD_HOME } from "@/common/urls"

const ENROLLMENT_TITLE_PARAM = "enrollment_title"
const ENROLLMENT_ORG_ID_PARAM = "enrollment_org_id"

type DashboardEnrollmentSuccessOpts = {
  title: string
  orgId?: number | null
}

const dashboardEnrollmentSuccessUrl = ({
  title,
  orgId,
}: DashboardEnrollmentSuccessOpts) => {
  const params = new URLSearchParams()
  params.set(ENROLLMENT_TITLE_PARAM, title)
  if (orgId !== null && orgId !== undefined) {
    params.set(ENROLLMENT_ORG_ID_PARAM, String(orgId))
  }
  return `${DASHBOARD_HOME}?${params.toString()}`
}

export {
  dashboardEnrollmentSuccessUrl,
  ENROLLMENT_TITLE_PARAM,
  ENROLLMENT_ORG_ID_PARAM,
}
export type { DashboardEnrollmentSuccessOpts }
