import {
  CourseRunEnrollmentRequestV2,
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"

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
  enrollments: CourseRunEnrollmentRequestV2[],
  organizationId: number,
): CourseRunEnrollmentRequestV2[] => {
  return enrollments.filter(
    (enrollment) => enrollment.b2b_organization_id === organizationId,
  )
}

/**
 * Helper to get the "best" run for a course (the next_run_id if available)
 * If contractId is provided, prefer runs matching that contract
 */
const getBestRun = (
  course: CourseWithCourseRunsSerializerV2,
  contractId?: number,
): CourseRunV2 | undefined => {
  if (!course.courseruns || course.courseruns.length === 0) return undefined

  const candidateRuns = course.courseruns
    .filter((run) => run.is_enrollable)
    .filter((run) => !contractId || run.b2b_contract === contractId)
  if (candidateRuns.length === 0) return undefined
  const nextRun = candidateRuns.find((run) => run.id === course.next_run_id)

  return nextRun ?? candidateRuns[0]
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
  enrollments: CourseRunEnrollmentRequestV2[],
): CourseRunEnrollmentRequestV2 | null => {
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
  enrollment: CourseRunEnrollmentRequestV2 | null,
): EnrollmentStatus => {
  if (!enrollment) {
    return EnrollmentStatus.NotEnrolled
  }
  const hasCompleted = enrollment.grades.some((grade) => grade.passed)
  return hasCompleted ? EnrollmentStatus.Completed : EnrollmentStatus.Enrolled
}

export {
  ResourceType,
  EnrollmentStatus,
  filterEnrollmentsByOrganization,
  getBestRun,
  selectBestEnrollment,
  getKey,
  getEnrollmentStatus,
}
