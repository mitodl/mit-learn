import {
  CourseRunEnrollmentV3,
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
  V2ProgramRequirement,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { getBestRun } from "@/common/mitxonline"
export { getBestRun }

const ResourceType = {
  Contract: "contract",
  Course: "course",
  Program: "program",
  ProgramCollection: "program_collection",
} as const
type ResourceType = (typeof ResourceType)[keyof typeof ResourceType]
const EnrollmentStatus = {
  NotEnrolled: "not_enrolled",
  Enrolled: "enrolled",
  Completed: "completed",
} as const
type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus]

type KeyOpts = {
  resourceType: ResourceType
  id: number
  runId?: number
}
const getKey = ({ resourceType, id, runId }: KeyOpts) => {
  const base = `${resourceType}-${id}`
  return runId ? `${base}-${runId}` : base
}

const filterEnrollmentsByOrganization = (
  enrollments: CourseRunEnrollmentV3[],
  organizationId: number,
): CourseRunEnrollmentV3[] => {
  return enrollments.filter(
    (enrollment) => enrollment.b2b_organization_id === organizationId,
  )
}

/**
 * Selects the best enrollment from multiple enrollments for the same course.
 * Priority:
 * 1. Prefer enrollment with a certificate
 * 2. If tied, prefer highest grade
 * 3. Otherwise take first match
 */
const selectBestEnrollment = (
  course: CourseWithCourseRunsSerializerV2,
  enrollments: CourseRunEnrollmentV3[],
): CourseRunEnrollmentV3 | null => {
  const courseEnrollments = enrollments.filter((enrollment) =>
    course.courseruns.some((run) => run.id === enrollment.run.id),
  )
  if (courseEnrollments.length === 0) {
    return null
  }
  return courseEnrollments.reduce((best, current) => {
    const bestHasCert = !!best.certificate?.uuid
    const currentHasCert = !!current.certificate?.uuid

    // Prioritize having a certificate
    if (currentHasCert && !bestHasCert) return current
    if (bestHasCert && !currentHasCert) return best

    // If both have or don't have certificates, compare grades
    const bestGrade = Math.max(0, ...best.grades.map((g) => g.grade ?? 0))
    const currentGrade = Math.max(0, ...current.grades.map((g) => g.grade ?? 0))
    return currentGrade > bestGrade ? current : best
  }, courseEnrollments[0])
}

const getEnrollmentStatus = (
  enrollment: CourseRunEnrollmentV3 | null,
): EnrollmentStatus => {
  if (!enrollment) {
    return EnrollmentStatus.NotEnrolled
  }
  const hasCompleted = enrollment.grades.some((grade) => grade.passed)
  return hasCompleted ? EnrollmentStatus.Completed : EnrollmentStatus.Enrolled
}

const getProgramEnrollmentStatus = (
  programEnrollment: V3UserProgramEnrollment | undefined,
  enrolledCourseCount: number,
  completedCourseCount = 0,
): EnrollmentStatus => {
  if (!programEnrollment) {
    return EnrollmentStatus.NotEnrolled
  }

  if (programEnrollment.certificate) {
    return EnrollmentStatus.Completed
  }

  if (completedCourseCount > 0 || enrolledCourseCount > 0) {
    return EnrollmentStatus.Enrolled
  }

  return EnrollmentStatus.NotEnrolled
}

export {
  ResourceType,
  EnrollmentStatus,
  filterEnrollmentsByOrganization,
  selectBestEnrollment,
  getKey,
  getEnrollmentStatus,
  getProgramEnrollmentStatus,
}

type CourseRequirementItem = {
  resourceType: "course"
  course: CourseWithCourseRunsSerializerV2
}

type ProgramAsCourseRequirementItem = {
  resourceType: "program-as-course"
  courseProgramId: number
  courseProgram: V2ProgramDetail
  courseProgramEnrollment: V3UserProgramEnrollment | undefined
}

type ProgramEnrollmentRequirementItem = {
  resourceType: "program-enrollment"
  enrollment: V3UserProgramEnrollment
}

type RequirementSectionItem =
  | CourseRequirementItem
  | ProgramAsCourseRequirementItem
  | ProgramEnrollmentRequirementItem

type RequirementSection = {
  key: string | number | null | undefined
  title: string
  items: RequirementSectionItem[]
  node: V2ProgramRequirement
}

const isRequirementSectionItemCompleted = (
  item: RequirementSectionItem,
  enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]>,
): boolean => {
  if (item.resourceType === "course") {
    const bestEnrollment = selectBestEnrollment(
      item.course,
      enrollmentsByCourseId[item.course.id] || [],
    )
    return getEnrollmentStatus(bestEnrollment) === EnrollmentStatus.Completed
  }
  if (item.resourceType === "program-as-course") {
    return (
      getProgramEnrollmentStatus(item.courseProgramEnrollment, 0, 0) ===
      EnrollmentStatus.Completed
    )
  }
  return false
}

/**
 * Computes the overall completed and total course counts for a program,
 * given its requirement sections and a map of enrollments by course ID.
 *
 * For `min_number_of` sections (electives), completions are capped at
 * the section's `operator_value` so that completing extra electives does
 * not inflate the required-course completion count shown in the header.
 */
const getProgramCounts = (
  sections: RequirementSection[],
  enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]>,
): { completed: number; total: number } => {
  return sections.reduce(
    (acc, section) => {
      const countableItems = section.items.filter(
        (item) =>
          item.resourceType === "course" ||
          item.resourceType === "program-as-course",
      )
      const sectionCompleted = countableItems.filter((item) =>
        isRequirementSectionItemCompleted(item, enrollmentsByCourseId),
      ).length

      if (
        section.node.data.operator === "min_number_of" &&
        section.node.data.operator_value
      ) {
        const minRequired = parseInt(section.node.data.operator_value, 10)
        if (!isNaN(minRequired)) {
          return {
            completed: acc.completed + Math.min(sectionCompleted, minRequired),
            total: acc.total + minRequired,
          }
        }
      }

      return {
        completed: acc.completed + sectionCompleted,
        total: acc.total + countableItems.length,
      }
    },
    { completed: 0, total: 0 },
  )
}

export type { RequirementSectionItem, RequirementSection }
export { isRequirementSectionItemCompleted, getProgramCounts }
