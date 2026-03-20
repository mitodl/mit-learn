import {
  CourseRunEnrollmentV3,
  CourseWithCourseRunsSerializerV2,
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

const getCourseRunEnrollmentStatus = (
  enrollment: CourseRunEnrollmentV3 | null,
): EnrollmentStatus => getEnrollmentStatus(enrollment)

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
  getCourseRunEnrollmentStatus,
  getProgramEnrollmentStatus,
}
