import type { SimpleSelectOption } from "ol-components"
import type {
  CourseRunEnrollmentV3,
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"

export type DashboardCourseSlot = {
  course: CourseWithCourseRunsSerializerV2
  enrollments: CourseRunEnrollmentV3[]
  selectedLanguageKey: string
  availableLanguages: SimpleSelectOption[]
  displayedEnrollment: CourseRunEnrollmentV3 | null
  displayedRun: CourseRunV2 | null
  contractId?: number
  isContractPageResource?: boolean
  ancestorContext?: {
    programEnrollment?: V3UserProgramEnrollment
    parentProgramReadableIds?: string[]
    useVerifiedEnrollment?: boolean
  }
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
