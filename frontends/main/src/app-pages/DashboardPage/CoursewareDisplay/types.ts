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

type DashboardCourseData = {
  title: string
  startDate?: string | null
  endDate?: string | null
  certificateUpgradeDeadline?: string | null
  certificateUpgradePrice?: string | null
  /**
   * Whether user can upgrade to verified certificate
   * (e.g., upgrade may be disabled after a certain date, or user may have
   * already upgraded)
   */
  canUpgrade: boolean
  hasUpgraded: boolean
  coursewareUrl: string | null
  marketingUrl: string
  enrollmentStatus: EnrollmentStatus
}

type DashboardProgramData = {
  title: string
  programType: string
  courseIds: number[]
  description: string
}

type DashboardCourse = {
  id: string
  type: typeof DashboardResourceType.Course
  data: DashboardCourseData
}
type DashboardProgram = {
  id: string
  type: typeof DashboardResourceType.Program
  data: DashboardProgramData
}

type DashboardResource = DashboardCourse | DashboardProgram

export { DashboardResourceType, EnrollmentStatus }
export type { DashboardResource, DashboardCourse, DashboardProgram }
