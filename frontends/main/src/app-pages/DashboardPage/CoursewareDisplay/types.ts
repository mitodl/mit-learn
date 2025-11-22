const DashboardResourceType = {
  Contract: "contract",
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

type DashboardContract = {
  id: number
  active: boolean
  contract_end: string | null
  contract_start: string | null
  description: string | null
  integration_type: string | null
  name: string | null
  organization: number | null
  slug: string | null
}

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
    canUpgrade: boolean | undefined
    certificate?: {
      uuid: string
      link: string
    }
  }
  enrollment?: DashboardCourseEnrollment
  marketingUrl: string
}
type DashboardCourseEnrollment = {
  id: number
  b2b_contract_id?: number | null | undefined
  b2b_organization_id?: number | null | undefined
  status: EnrollmentStatus
  mode: EnrollmentMode
  receiveEmails?: boolean
  certificate?: {
    uuid: string
    link: string
  }
}

type DashboardProgramEnrollment = {
  status: EnrollmentStatus
  certificate?: {
    uuid: string
    link: string
  }
}

type DashboardProgramRequirementNodeType = "course" | "program" | "operator"

type DashboardProgramRequirementData = {
  nodeType: DashboardProgramRequirementNodeType
  course?: number | null
  program?: number | null
  requiredProgram?: number | null
  title?: string | null
  operator?: string | null
  operatorValue?: string | null
  electiveFlag?: boolean | null
}

type DashboardProgramRequirement = {
  id?: number | null
  data: DashboardProgramRequirementData
  children?: DashboardProgramRequirement[]
}

type DashboardProgram = {
  id: number
  key: string
  type: typeof DashboardResourceType.Program
  title: string
  programType?: string | null
  courseIds: number[]
  collections: number[]
  description: string
  enrollment?: DashboardProgramEnrollment
  reqTree: DashboardProgramRequirement[]
}

type DashboardProgramCollection = {
  id: number
  type: typeof DashboardResourceType.ProgramCollection
  title: string
  description?: string | null
  programs: DashboardProgramCollectionProgram[]
}

type DashboardProgramCollectionProgram = {
  id?: number
  title?: string
  order?: number
}

type DashboardResource =
  | DashboardCourse
  | DashboardProgram
  | DashboardProgramCollection

export { DashboardResourceType, EnrollmentStatus, EnrollmentMode }
export type {
  DashboardResource,
  DashboardContract,
  DashboardCourse,
  DashboardCourseEnrollment,
  DashboardProgramEnrollment,
  DashboardProgram,
  DashboardProgramRequirement,
  DashboardProgramRequirementData,
  DashboardProgramRequirementNodeType,
  DashboardProgramCollection,
  DashboardProgramCollectionProgram,
}
