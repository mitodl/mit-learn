import { DASHBOARD_HOME } from "@/common/urls"

export const ENROLLMENT_SUCCESS_QUERY_PARAM = "enrollment_success"

const DASHBOARD_ENROLLMENT_TITLE_KEY = "dashboard_enrollment_title"
const DASHBOARD_ENROLLMENT_ORG_ID_KEY = "dashboard_enrollment_org_id"

type DashboardEnrollmentStorage = {
  title: string
  orgId: number | null
}

type DashboardEnrollmentStorageInput = {
  title: string
  orgId?: number | null
}

const storeDashboardEnrollmentStorage = ({
  title,
  orgId = null,
}: DashboardEnrollmentStorageInput) => {
  sessionStorage.setItem(DASHBOARD_ENROLLMENT_TITLE_KEY, title)

  if (orgId === null) {
    sessionStorage.removeItem(DASHBOARD_ENROLLMENT_ORG_ID_KEY)
  } else {
    sessionStorage.setItem(DASHBOARD_ENROLLMENT_ORG_ID_KEY, String(orgId))
  }
}

const readDashboardEnrollmentStorage =
  (): DashboardEnrollmentStorage | null => {
    const title = sessionStorage.getItem(DASHBOARD_ENROLLMENT_TITLE_KEY)
    if (!title) return null

    const orgId = sessionStorage.getItem(DASHBOARD_ENROLLMENT_ORG_ID_KEY)

    return {
      title,
      orgId: orgId ? Number(orgId) : null,
    }
  }

const clearDashboardEnrollmentStorage = () => {
  sessionStorage.removeItem(DASHBOARD_ENROLLMENT_TITLE_KEY)
  sessionStorage.removeItem(DASHBOARD_ENROLLMENT_ORG_ID_KEY)
}

const dashboardEnrollmentSuccessUrl = () =>
  `${DASHBOARD_HOME}?${ENROLLMENT_SUCCESS_QUERY_PARAM}=1`

export {
  storeDashboardEnrollmentStorage,
  readDashboardEnrollmentStorage,
  clearDashboardEnrollmentStorage,
  dashboardEnrollmentSuccessUrl,
}
export type { DashboardEnrollmentStorage, DashboardEnrollmentStorageInput }
