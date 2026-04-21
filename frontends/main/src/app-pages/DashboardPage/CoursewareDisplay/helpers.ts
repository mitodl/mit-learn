import {
  CourseRunEnrollmentV3,
  CourseWithCourseRunsSerializerV2,
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

const isLeafRequirementNodeCompleted = (
  node: V2ProgramRequirement,
  courseEnrollments: Record<number, CourseRunEnrollmentV3[]>,
  programEnrollments: Record<number, V3UserProgramEnrollment>,
): boolean => {
  if (
    node.data.node_type === "course" &&
    typeof node.data.course === "number"
  ) {
    const enrollments = courseEnrollments[node.data.course] ?? []
    return enrollments.some((e) => e.grades.some((g) => g.passed))
  }
  if (node.data.node_type === "program" && node.data.required_program) {
    return !!programEnrollments[node.data.required_program]?.certificate
  }
  return false
}

/**
 * Computes `{ completed, total }` across the given operator nodes.
 *
 * Assumes a flat req_tree: each operator's direct children are leaves
 * (`node_type: "course"` or `"program"`). Nesting operators inside
 * operators is not supported — there is no single well-defined reduction
 * for nested progress (e.g., with `min_number_of=1` parent over two
 * `min_number_of=4` children, "max child progress" and "sum of all work"
 * give different answers, and picking one is a product question).
 *
 * Only `all_of` and `min_number_of` (with a valid integer `operator_value`)
 * are counted. Unknown or malformed operators contribute nothing and log
 * a warning — we'd rather under-report than guess.
 *
 * For `min_number_of` operators, `completed` is capped at `operator_value`
 * so extra electives don't inflate the overall total.
 *
 * Pass all top-level operators for overall program progress, or a single
 * operator node for per-section progress.
 */
const getRequirementsProgress = (
  nodes: V2ProgramRequirement[],
  courseEnrollments: Record<number, CourseRunEnrollmentV3[]>,
  programEnrollments: Record<number, V3UserProgramEnrollment>,
): { completed: number; total: number } => {
  return nodes.reduce(
    (acc, node) => {
      if (node.data.node_type !== "operator") return acc

      const leaves = (node.children ?? []).filter(
        (c) => c.data.node_type === "course" || c.data.node_type === "program",
      )
      const completed = leaves.filter((leaf) =>
        isLeafRequirementNodeCompleted(
          leaf,
          courseEnrollments,
          programEnrollments,
        ),
      ).length

      if (node.data.operator === "all_of") {
        return {
          completed: acc.completed + completed,
          total: acc.total + leaves.length,
        }
      }

      if (node.data.operator === "min_number_of") {
        const minRequired = parseInt(node.data.operator_value ?? "", 10)
        if (!isNaN(minRequired)) {
          return {
            completed: acc.completed + Math.min(completed, minRequired),
            total: acc.total + minRequired,
          }
        }
      }

      console.warn(
        `getRequirementsProgress: unsupported operator "${node.data.operator}" (operator_value=${JSON.stringify(node.data.operator_value)}); skipping.`,
      )
      return acc
    },
    { completed: 0, total: 0 },
  )
}

export { getRequirementsProgress }
