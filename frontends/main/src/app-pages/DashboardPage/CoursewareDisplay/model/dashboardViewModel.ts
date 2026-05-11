/**
 * Pure-model layer for the dashboard.
 *
 * Owns the canonical types (e.g. DashboardCourseSlot) and the pure transforms
 * — grouping, slot construction, display policy — that data hooks compose into
 * render-ready shapes. No React, no queries; everything is synchronous and
 * unit-testable in isolation.
 */
import type { SimpleSelectOption } from "ol-components"
import type {
  CourseRunEnrollmentV3,
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"

/**
 * A program/contract dashboard's view of a course: every enrollment whose run
 * belongs to this course, plus a derived display choice for the legacy
 * single-enrollment card UI.
 *
 * `enrollments` must be course-matched (by run id) with no language filter —
 * language is a display selection (`selectedLanguageKey` → `displayedEnrollment`
 * / `displayedRun`), not a filter on the underlying list. Contract scoping,
 * when applicable, must be applied by the slot constructor before the list
 * reaches the slot.
 */
export type DashboardCourseSlot = {
  course: CourseWithCourseRunsSerializerV2
  enrollments: CourseRunEnrollmentV3[]
  selectedLanguageKey: string
  availableLanguages: SimpleSelectOption[]
  contractId?: number
  isContractPageResource?: boolean
  ancestorContext?: {
    programEnrollment?: V3UserProgramEnrollment
    parentProgramReadableIds?: string[]
    useVerifiedEnrollment?: boolean
  }
  // Whether these fields survive past the legacy-card removal is an open tied
  // to new card UX (run selection controlled by card or parent.)
  displayedEnrollment: CourseRunEnrollmentV3 | null
  displayedRun: CourseRunV2 | null
}

const getMaxEnrollmentGrade = (enrollment: CourseRunEnrollmentV3): number => {
  return Math.max(0, ...enrollment.grades.map((grade) => grade.grade ?? 0))
}

/**
 * Legacy display policy used by dashboard cards.
 *
 * Priority:
 * 1. Prefer enrollment with a certificate
 * 2. If tied, prefer highest grade
 * 3. Otherwise take first match
 */
const pickDisplayedEnrollmentForLegacyDashboard = (
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

    if (currentHasCert && !bestHasCert) return current
    if (bestHasCert && !currentHasCert) return best

    const bestGrade = getMaxEnrollmentGrade(best)
    const currentGrade = getMaxEnrollmentGrade(current)
    return currentGrade > bestGrade ? current : best
  }, courseEnrollments[0])
}

const groupCourseRunEnrollmentsByCourseId = (
  courses: CourseWithCourseRunsSerializerV2[],
  enrollments: CourseRunEnrollmentV3[],
): Record<number, CourseRunEnrollmentV3[]> => {
  const runIdToCourseId = new Map<number, number>()
  courses.forEach((course) => {
    course.courseruns.forEach((run) => {
      runIdToCourseId.set(run.id, course.id)
    })
  })

  return enrollments.reduce<Record<number, CourseRunEnrollmentV3[]>>(
    (acc, enrollment) => {
      const courseId = runIdToCourseId.get(enrollment.run.id)
      if (!courseId) {
        return acc
      }

      acc[courseId] = [...(acc[courseId] ?? []), enrollment]
      return acc
    },
    {},
  )
}

const groupProgramEnrollmentsByProgramId = (
  programEnrollments: V3UserProgramEnrollment[],
): Record<number, V3UserProgramEnrollment> => {
  return programEnrollments.reduce<Record<number, V3UserProgramEnrollment>>(
    (acc, enrollment) => {
      acc[enrollment.program.id] = enrollment
      return acc
    },
    {},
  )
}

export {
  pickDisplayedEnrollmentForLegacyDashboard,
  groupCourseRunEnrollmentsByCourseId,
  groupProgramEnrollmentsByProgramId,
}
