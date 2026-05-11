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
  CourseRunLanguageOption,
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { selectBestEnrollment } from "../helpers"
import {
  getCourseRunForSelectedLanguage,
  getDistinctLanguageOptions,
  getEnrollmentForSelectedLanguage,
  getResolvedRunForSelectedLanguage,
  getSelectedLanguageOption,
  selectBestContractEnrollmentForLanguage,
} from "../languageOptions"

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

const getLanguageCodeFromText = (language?: string | null): string | null => {
  const normalized = language?.trim().toLowerCase().replace(/_/g, "-")
  return normalized || null
}

const getLanguageLabelFromCode = (languageCode: string): string => {
  const normalized = languageCode.trim().toLowerCase()
  const baseLanguageCode = normalized.split("-")[0]

  try {
    if (typeof Intl.DisplayNames === "function") {
      const displayNames = new Intl.DisplayNames([normalized], {
        type: "language",
      })
      const exact = displayNames.of(normalized)
      if (exact && exact.toLowerCase() !== normalized) {
        return exact
      }

      if (baseLanguageCode && baseLanguageCode !== normalized) {
        const base = displayNames.of(baseLanguageCode)
        if (base && base.toLowerCase() !== baseLanguageCode) {
          return base
        }
      }
    }
  } catch {
    // Fall through and use normalized code.
  }

  return baseLanguageCode || normalized
}

const getLanguageOptionFromEnrollment = (
  enrollment: CourseRunEnrollmentV3,
): SimpleSelectOption | null => {
  const languageCode = getLanguageCodeFromText(enrollment.run.language)
  if (!languageCode) {
    return null
  }

  return {
    value: `language:${languageCode}`,
    label: getLanguageLabelFromCode(languageCode),
  }
}

const enrollmentMatchesCourse = (
  course: CourseWithCourseRunsSerializerV2,
  enrollment: CourseRunEnrollmentV3,
): boolean => {
  const run = enrollment.run
  if (!run) {
    return false
  }

  if (run.course.id === course.id) {
    return true
  }

  return course.courseruns.some((courseRun) => courseRun.id === run.id)
}

type LanguageOptionScope = {
  contractId?: number
}

const getDashboardLanguageOptions = (
  course: CourseWithCourseRunsSerializerV2,
  enrollments: CourseRunEnrollmentV3[],
  opts?: LanguageOptionScope,
): SimpleSelectOption[] => {
  const optionsByKey = new Map<string, SimpleSelectOption>()

  getDistinctLanguageOptions([course]).forEach((option) => {
    optionsByKey.set(String(option.value), option)
  })

  const scopedEnrollments =
    typeof opts?.contractId === "number"
      ? enrollments.filter(
          (enrollment) => enrollment.b2b_contract_id === opts.contractId,
        )
      : enrollments

  scopedEnrollments.forEach((enrollment) => {
    if (!enrollmentMatchesCourse(course, enrollment)) {
      return
    }

    const derivedOption = getLanguageOptionFromEnrollment(enrollment)
    if (!derivedOption) {
      return
    }

    if (!optionsByKey.has(String(derivedOption.value))) {
      optionsByKey.set(String(derivedOption.value), derivedOption)
    }
  })

  return Array.from(optionsByKey.values())
}

const getDistinctDashboardLanguageOptions = (
  courses: CourseWithCourseRunsSerializerV2[],
  enrollments: CourseRunEnrollmentV3[],
  opts?: LanguageOptionScope,
): SimpleSelectOption[] => {
  const baseOptions = getDistinctLanguageOptions(courses)
  const optionsByKey = new Map<string, SimpleSelectOption>()
  baseOptions.forEach((option) => {
    optionsByKey.set(String(option.value), option)
  })

  const courseIds = new Set(courses.map((course) => course.id))
  const scopedEnrollments =
    typeof opts?.contractId === "number"
      ? enrollments.filter(
          (enrollment) => enrollment.b2b_contract_id === opts.contractId,
        )
      : enrollments

  scopedEnrollments.forEach((enrollment) => {
    if (!courseIds.has(enrollment.run.course.id)) {
      return
    }

    const derivedOption = getLanguageOptionFromEnrollment(enrollment)
    if (!derivedOption) {
      return
    }

    if (!optionsByKey.has(String(derivedOption.value))) {
      optionsByKey.set(String(derivedOption.value), derivedOption)
    }
  })

  const additionalOptions = Array.from(optionsByKey.values()).filter(
    (option) =>
      !baseOptions.some(
        (base) =>
          getLanguageOptionKeyValue(base) === getLanguageOptionKeyValue(option),
      ),
  )

  additionalOptions.sort((a, b) =>
    String(a.label).localeCompare(String(b.label)),
  )

  return [...baseOptions, ...additionalOptions]
}

const getLanguageOptionKeyValue = (option: SimpleSelectOption): string =>
  String(option.value)

type ResolveCardDataForLanguageOpts = {
  contractId?: number
}

type ResolveCardDataForLanguageResult = {
  displayedEnrollment: CourseRunEnrollmentV3 | null
  displayedRun: CourseRunV2 | null
  selectedLanguageOption: CourseRunLanguageOption | null
}

const resolveCardDataForLanguage = (
  course: CourseWithCourseRunsSerializerV2,
  enrollments: CourseRunEnrollmentV3[],
  selectedLanguageKey: string,
  opts?: ResolveCardDataForLanguageOpts,
): ResolveCardDataForLanguageResult => {
  const selectedLanguageOption = getSelectedLanguageOption(
    course,
    selectedLanguageKey,
  )
  const selectedRun = getCourseRunForSelectedLanguage(
    course,
    selectedLanguageKey,
  )

  if (typeof opts?.contractId === "number") {
    const contractEnrollments = enrollments.filter(
      (enrollment) => enrollment.b2b_contract_id === opts.contractId,
    )
    const displayedEnrollment = selectBestContractEnrollmentForLanguage(
      course,
      contractEnrollments,
      selectedLanguageKey,
    )
    const selectedRunForResolution = displayedEnrollment
      ? ((course.courseruns ?? []).find(
          (run) => run.id === displayedEnrollment.run.id,
        ) ?? null)
      : selectedRun

    const displayedRun = getResolvedRunForSelectedLanguage(
      course,
      selectedLanguageOption,
      selectedRunForResolution,
      displayedEnrollment,
      opts.contractId,
    )

    return {
      displayedEnrollment,
      displayedRun,
      selectedLanguageOption,
    }
  }

  const selectedLanguageEnrollment = getEnrollmentForSelectedLanguage(
    enrollments,
    selectedLanguageOption,
    selectedRun,
  )
  const displayedEnrollment = selectedLanguageKey
    ? selectedLanguageEnrollment
    : selectBestEnrollment(course, enrollments)

  const displayedRun = getResolvedRunForSelectedLanguage(
    course,
    selectedLanguageOption,
    selectedRun,
    selectedLanguageEnrollment,
  )

  return {
    displayedEnrollment,
    displayedRun,
    selectedLanguageOption,
  }
}

export {
  pickDisplayedEnrollmentForLegacyDashboard,
  groupCourseRunEnrollmentsByCourseId,
  groupProgramEnrollmentsByProgramId,
  resolveCardDataForLanguage,
  getDashboardLanguageOptions,
  getDistinctDashboardLanguageOptions,
}
