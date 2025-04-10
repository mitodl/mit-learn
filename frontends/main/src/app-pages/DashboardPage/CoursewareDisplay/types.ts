const DashboardResourceType = {
  Course: "course",
  Program: "program",
} as const
type DashboardResourceType =
  (typeof DashboardResourceType)[keyof typeof DashboardResourceType]

const EnrollmentStatus = {
  NotEnrolled: "not_enrolled",
  Enrolled: "enrolled",
  Completed: "completed",
} as const
type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus]

const EnrollmentMode = {
  Audit: "audit",
  Verified: "verified",
} as const
type EnrollmentMode = (typeof EnrollmentMode)[keyof typeof EnrollmentMode]

type DashboardCourse = {
  id: string
  title: string
  type: typeof DashboardResourceType.Course
  run: {
    startDate?: string | null
    endDate?: string | null
    certificateUpgradeDeadline?: string | null
    certificateUpgradePrice?: string | null
    coursewareUrl: string | null
    canUpgrade: boolean
  }
  enrollment?: {
    status: EnrollmentStatus
    mode: EnrollmentMode
  }
  marketingUrl: string
}

type DashboardProgram = {
  id: string
  type: typeof DashboardResourceType.Program
  title: string
  programType: string
  courseIds: number[]
  description: string
}

type DashboardResource = DashboardCourse | DashboardProgram

export { DashboardResourceType, EnrollmentStatus, EnrollmentMode }
export type { DashboardResource, DashboardCourse, DashboardProgram }
