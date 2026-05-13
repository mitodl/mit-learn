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
  BaseProgramDisplayMode,
  ContractPage,
  CourseRunEnrollmentV3,
  CourseRunLanguageOption,
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { getIdsFromReqTree } from "@/common/mitxonline"
import {
  EnrollmentStatus,
  getEnrollmentStatus,
  selectBestEnrollment,
} from "../helpers"
import {
  getNativeLanguageName,
  // below five are used only for resolveSlotForLanguage
  getCourseRunForSelectedLanguage,
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
  enrollments: CourseRunEnrollmentV3[],
): Record<number, CourseRunEnrollmentV3[]> => {
  return enrollments.reduce<Record<number, CourseRunEnrollmentV3[]>>(
    (acc, enrollment) => {
      const courseId = enrollment.run.course.id
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

const isProgramAsCourse = (program: {
  display_mode?: BaseProgramDisplayMode | null
}) => program.display_mode === DisplayModeEnum.Course

const isNonContractEnrollment = (enrollment: CourseRunEnrollmentV3) =>
  !enrollment.b2b_contract_id

/**
 * Closure-factory predicate: returns a predicate that tests whether an
 * enrollment's course id appears in any of the given programs' `courses[]`.
 * The Set is built once per factory call and reused across the predicate's
 * invocations, so the natural usage is `enrollments.filter(predicate)`.
 */
const enrollmentCourseIsInPrograms = (programs: V2ProgramDetail[]) => {
  const coveredCourseIds = new Set(programs.flatMap((p) => p.courses))
  return (enrollment: CourseRunEnrollmentV3) =>
    coveredCourseIds.has(enrollment.run.course.id)
}

const getNonContractProgramEnrollments = (
  programEnrollments: V3UserProgramEnrollment[],
  contracts: ContractPage[],
) => {
  const contractPrograms = new Set(
    contracts.flatMap((contract) => contract.programs),
  )
  return programEnrollments.filter(
    (enrollment) => !contractPrograms.has(enrollment.program.id),
  )
}

const getTopLevelProgramEnrollments = (
  programEnrollments: V3UserProgramEnrollment[],
  programs: V2ProgramDetail[],
) => {
  const childIds = new Set(
    programs.flatMap(
      (program) => getIdsFromReqTree(program.req_tree).programIds,
    ),
  )
  return programEnrollments.filter(
    (enrollment) => !childIds.has(enrollment.program.id),
  )
}

/**
 * Distinct course ids referenced anywhere in the given programs' req_trees.
 * Used to drive the home dashboard's program-as-course module course query.
 */
const getModuleCourseIdsFromPrograms = (
  programs: V2ProgramDetail[],
): number[] => {
  return [
    ...new Set(
      programs.flatMap(
        (program) => getIdsFromReqTree(program.req_tree).courseIds,
      ),
    ),
  ]
}

/**
 * For each program, the subset of `courses` whose ids appear in
 * `program.courses[]`. Used by both home and program dashboards to wire
 * program-as-course module data into the cards that render it.
 */
const groupModuleCoursesByProgramId = (
  programs: V2ProgramDetail[],
  courses: CourseWithCourseRunsSerializerV2[],
): Record<number, CourseWithCourseRunsSerializerV2[]> => {
  return programs.reduce<Record<number, CourseWithCourseRunsSerializerV2[]>>(
    (acc, program) => {
      const programCourseIds = new Set(program.courses)
      acc[program.id] = courses.filter((course) =>
        programCourseIds.has(course.id),
      )
      return acc
    },
    {},
  )
}

const byTitle = (a: CourseRunEnrollmentV3, b: CourseRunEnrollmentV3) =>
  a.run.course.title.localeCompare(b.run.course.title)

const byStartsSooner = (a: CourseRunEnrollmentV3, b: CourseRunEnrollmentV3) => {
  if (!a.run.start_date && !b.run.start_date) return 0
  if (!a.run.start_date) return 1
  if (!b.run.start_date) return -1
  return (
    new Date(a.run.start_date).getTime() - new Date(b.run.start_date).getTime()
  )
}

type HomeEnrollmentBuckets = {
  started: CourseRunEnrollmentV3[]
  notStarted: CourseRunEnrollmentV3[]
  completed: CourseRunEnrollmentV3[]
  expired: CourseRunEnrollmentV3[]
}

/**
 * Bucket enrollments into the four home-dashboard sections and sort each
 * bucket. Assumes input is already filtered to the enrollments the home
 * dashboard renders (e.g. non-contract).
 *
 * Bucket policy:
 *  - completed: any passing grade
 *  - expired: end_date in the past
 *  - started: start_date in the past, not expired, not completed
 *  - notStarted: everything else
 *
 * Sort policy: alphabetical by course title in every bucket except
 * notStarted, which is sorted by start_date ascending.
 */
const bucketAndSortHomeEnrollments = (
  enrollments: CourseRunEnrollmentV3[],
): HomeEnrollmentBuckets => {
  const now = new Date()
  const buckets: HomeEnrollmentBuckets = {
    started: [],
    notStarted: [],
    completed: [],
    expired: [],
  }
  enrollments.forEach((enrollment) => {
    if (getEnrollmentStatus(enrollment) === EnrollmentStatus.Completed) {
      buckets.completed.push(enrollment)
    } else if (
      enrollment.run.end_date &&
      new Date(enrollment.run.end_date) < now
    ) {
      buckets.expired.push(enrollment)
    } else if (
      enrollment.run.start_date &&
      new Date(enrollment.run.start_date) < now
    ) {
      buckets.started.push(enrollment)
    } else {
      buckets.notStarted.push(enrollment)
    }
  })
  return {
    started: buckets.started.sort(byTitle),
    notStarted: buckets.notStarted.sort(byStartsSooner),
    completed: buckets.completed.sort(byTitle),
    expired: buckets.expired.sort(byTitle),
  }
}

/**
 * The mitxonline API emits language codes in POSIX form (`de_de`,
 * `pt_br`, `zh_hans`); convert to BCP 47 (`de-de`, `pt-br`, `zh-hans`)
 * so `Intl.DisplayNames` can resolve them, and to give picker options a
 * canonical key shape.
 */
const getLanguageCodeFromText = (language: string): string => {
  return language.trim().toLowerCase().replace(/_/g, "-")
}

const filterEnrollmentsToCourses = (
  enrollments: CourseRunEnrollmentV3[],
  courses: CourseWithCourseRunsSerializerV2[],
) => {
  const courseIds = new Set(courses.map((course) => course.id))
  return enrollments.filter((enrollment) =>
    courseIds.has(enrollment.run.course.id),
  )
}

/**
 * Filter enrollments to exclusively those matching the given contractId.
 * If no contractId is given, filter to enrollments with no contract.
 */
const enrollmentMatchesContract =
  (contractId?: number | null) => (enrollment: CourseRunEnrollmentV3) => {
    if (typeof contractId !== "number") {
      return enrollment.b2b_contract_id === null
    }
    return enrollment.b2b_contract_id === contractId
  }

type LanguageOptionScope = {
  contractId?: number
}

const getDistinctDashboardLanguageOptions = (
  courses: CourseWithCourseRunsSerializerV2[],
  enrollments: CourseRunEnrollmentV3[],
  opts?: LanguageOptionScope,
): SimpleSelectOption[] => {
  const coursesLanguages = courses.flatMap((c) =>
    c.language_options
      .map((opt) => opt.language)
      .filter((lang): lang is string => !!lang),
  )
  const enrollmentLanguages = filterEnrollmentsToCourses(enrollments, courses)
    .filter(enrollmentMatchesContract(opts?.contractId))
    .map((e) => e.run.language)
    .filter((lang): lang is string => !!lang)
  const distinctCodes = Array.from(
    new Set(
      [...coursesLanguages, ...enrollmentLanguages].map(
        getLanguageCodeFromText,
      ),
    ),
  )
  const options: SimpleSelectOption[] = distinctCodes.map((code) => {
    return {
      value: `language:${code}`,
      label: getNativeLanguageName(code),
    }
  })
  options.sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, {
      sensitivity: "base",
    }),
  )
  return options
}

type ResolveSlotForLanguageOpts = {
  contractId?: number
}

type ResolveSlotForLanguageResult = {
  displayedEnrollment: CourseRunEnrollmentV3 | null
  displayedRun: CourseRunV2 | null
  selectedLanguageOption: CourseRunLanguageOption | null
}

/**
 * Given a language selection and course/enrollment data, pick the
 * `displayedEnrollment` and `displayedRun` for a dashboard slot.
 */
const resolveSlotForLanguage = (
  course: CourseWithCourseRunsSerializerV2,
  enrollments: CourseRunEnrollmentV3[],
  selectedLanguageKey: string,
  opts?: ResolveSlotForLanguageOpts,
): ResolveSlotForLanguageResult => {
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
  resolveSlotForLanguage,
  getDistinctDashboardLanguageOptions,
  isProgramAsCourse,
  isNonContractEnrollment,
  enrollmentCourseIsInPrograms,
  getNonContractProgramEnrollments,
  getTopLevelProgramEnrollments,
  getModuleCourseIdsFromPrograms,
  groupModuleCoursesByProgramId,
  bucketAndSortHomeEnrollments,
}
