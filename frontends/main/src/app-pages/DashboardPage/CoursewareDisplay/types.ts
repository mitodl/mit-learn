const DashboardResourceType = {
  Course: "course",
  Program: "program",
  ProgramCollection: "program_collection",
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
  key: string
  coursewareId: string | null
  title: string
  type: typeof DashboardResourceType.Course
  run: {
    startDate?: string | null
    endDate?: string | null
    certificateUpgradeDeadline?: string | null
    certificateUpgradePrice?: string | null
    coursewareUrl?: string | null
    canUpgrade: boolean
  }
  enrollment?: {
    id: number
    status: EnrollmentStatus
    mode: EnrollmentMode
    receiveEmails?: boolean
  }
  marketingUrl: string
}
type DashboardCourseEnrollment = {
  id: number
  status: EnrollmentStatus
  mode: EnrollmentMode
  receiveEmails?: boolean
}

type DashboardProgram = {
  id: number
  key: string
  type: typeof DashboardResourceType.Program
  title: string
  programType?: string | null
  courseIds: number[]
  description: string
}

type DashboardProgramCollection = {
  id: number
  type: typeof DashboardResourceType.ProgramCollection
  title: string
  description?: string | null
  programIds: number[]
}

type DashboardResource =
  | DashboardCourse
  | DashboardProgram
  | DashboardProgramCollection

export { DashboardResourceType, EnrollmentStatus, EnrollmentMode }
export type {
  DashboardResource,
  DashboardCourse,
  DashboardCourseEnrollment,
  DashboardProgram,
  DashboardProgramCollection,
}
