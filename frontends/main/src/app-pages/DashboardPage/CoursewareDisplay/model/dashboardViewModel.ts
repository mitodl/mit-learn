/**
 * Pure-model layer for the dashboard.
 *
 * Owns the canonical types (e.g. DashboardCourseEntry) and the pure transforms
 * — grouping, entry construction, display policy — that data hooks compose into
 * render-ready shapes. No React, no queries; everything is synchronous and
 * unit-testable in isolation.
 */
import type {
  BaseCourseRun,
  BaseProgramDisplayMode,
  ContractPage,
  CourseRunEnrollmentV3,
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
  SupportedVariant,
  V2Program,
  V2ProgramCollection,
  V2ProgramDetail,
  V2ProgramRequirement,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
// Type-only import: erased at compile time, so this line adds no runtime
// dependency on the DashboardCard component. DashboardResource is the durable
// enrollment-flat home contract; it moves into this file when the legacy
// cards are removed (Phase 7).
import type { DashboardResource } from "../DashboardCard"
import {
  getBestRun,
  getIdsFromReqTree,
  parseProgramRequirementSections,
} from "@/common/mitxonline"
import type { ProgramRequirementSection } from "@/common/mitxonline"
import {
  EnrollmentStatus,
  getEnrollmentStatus,
  getRequirementsProgress,
  selectBestEnrollment,
} from "../helpers"

/**
 * A program/contract dashboard's view of a course: every enrollment whose run
 * belongs to this course, plus a derived display choice for the legacy
 * single-enrollment card UI.
 *
 * `enrollments` must be course-matched (by run id) with no language filter —
 * `displayedEnrollment` and `displayedRun` are the resolved display choice for
 * the legacy single-enrollment card UI. Contract scoping, when applicable,
 * must be applied by the entry constructor before the list reaches the entry.
 */
export type DashboardCourseEntry = {
  course: CourseWithCourseRunsSerializerV2
  enrollments: CourseRunEnrollmentV3[]
  contractId?: number
  isContractPageResource?: boolean
  ancestorContext?: {
    programEnrollment?: V3UserProgramEnrollment
    parentProgramReadableIds?: string[]
    useVerifiedEnrollment?: boolean
  }
  // Whether these fields survive past the legacy-card removal is an open
  // question tied to new card UX (run selection controlled by card or parent).
  displayedEnrollment: CourseRunEnrollmentV3 | null
  displayedRun: BaseCourseRun | null
}

const getMaxEnrollmentGrade = (enrollment: CourseRunEnrollmentV3): number => {
  return Math.max(0, ...enrollment.grades.map((grade) => grade.grade ?? 0))
}

const enrollmentBelongsToCourse = (
  course: CourseWithCourseRunsSerializerV2,
  enrollment: CourseRunEnrollmentV3,
): boolean => {
  if (enrollment.run.course?.id === course.id) {
    return true
  }

  return course.courseruns.some((run) => run.id === enrollment.run.id)
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
    enrollmentBelongsToCourse(course, enrollment),
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
 * Minimum number of cards the home dashboard shows before "Show all" when
 * every card is expired (so the section is never blank for an enrolled user).
 */
const MIN_VISIBLE_HOME_CARDS = 3

type HomeCardListInput = HomeEnrollmentBuckets & {
  programEnrollments: V3UserProgramEnrollment[]
}

type HomeCardList = {
  cards: DashboardResource[]
  initiallyVisibleCount: number
}

/**
 * Flatten home buckets into the single ordered card list the dashboard
 * renders, plus how many of those cards are visible before "Show all".
 *
 * Order: started, notStarted, completed, programEnrollments, then expired.
 *
 * Visibility rule (preserves legacy behavior): if there is at least one
 * non-expired card, all non-expired cards are visible and every expired card
 * is hidden behind "Show all". If there are no non-expired cards, up to
 * MIN_VISIBLE_HOME_CARDS expired cards are promoted into view.
 */
const assembleHomeCardList = ({
  started,
  notStarted,
  completed,
  expired,
  programEnrollments,
}: HomeCardListInput): HomeCardList => {
  const courseRunCard = (data: CourseRunEnrollmentV3): DashboardResource => ({
    type: "courserun-enrollment",
    data,
  })

  const nonExpired: DashboardResource[] = [
    ...started.map(courseRunCard),
    ...notStarted.map(courseRunCard),
    ...completed.map(courseRunCard),
    ...programEnrollments.map(
      (data): DashboardResource => ({ type: "program-enrollment", data }),
    ),
  ]
  const expiredCards = expired.map(courseRunCard)

  return {
    cards: [...nonExpired, ...expiredCards],
    initiallyVisibleCount:
      nonExpired.length > 0
        ? nonExpired.length
        : Math.min(MIN_VISIBLE_HOME_CARDS, expiredCards.length),
  }
}

/**
 * Build the displayed run for a course entry by merging the enrollment's
 * run data (V3) onto a CourseRunV2 template, or returning the selected run
 * directly when the user has no enrollment.
 *
 * With a contract constraint, the selected run is scoped to that contract
 * before the merge; if it doesn't belong to the contract a fresh best-run
 * lookup is used as the template instead.
 */
const synthesizeDisplayedRun = (
  course: CourseWithCourseRunsSerializerV2,
  selectedRun: CourseRunV2 | null,
  enrollment: CourseRunEnrollmentV3 | null,
  contractId?: number,
): BaseCourseRun | null => {
  // Apply contract scope to the selected run.
  let scopedSelectedRun = selectedRun
  if (
    typeof contractId === "number" &&
    selectedRun &&
    "b2b_contract" in selectedRun &&
    (selectedRun as { b2b_contract?: number | null }).b2b_contract !==
      contractId
  ) {
    scopedSelectedRun = null
  }

  let templateRun = scopedSelectedRun
  if (!templateRun) {
    templateRun =
      (typeof contractId === "number"
        ? getBestRun(course, { contractId })
        : getBestRun(course)) ?? null
  }

  const enrollmentRun = enrollment?.run
  if (enrollmentRun) {
    if (!templateRun) {
      return null
    }
    return {
      ...templateRun,
      id: enrollmentRun.id,
      title: enrollmentRun.title,
      courseware_id: enrollmentRun.courseware_id,
      courseware_url: enrollmentRun.courseware_url,
      run_tag: enrollmentRun.run_tag,
      start_date: enrollmentRun.start_date,
      end_date: enrollmentRun.end_date,
      is_enrollable: enrollmentRun.is_enrollable,
      is_upgradable: enrollmentRun.is_upgradable,
      is_archived: enrollmentRun.is_archived,
      is_self_paced: enrollmentRun.is_self_paced,
      upgrade_deadline: enrollmentRun.upgrade_deadline,
      certificate_available_date: enrollmentRun.certificate_available_date,
      course_number: enrollmentRun.course_number,
    }
  }

  return scopedSelectedRun
}

/**
 * Resolve the `displayedEnrollment` and `displayedRun` for a dashboard course
 * entry.
 *
 * Options:
 *  - `contractId`: when present, scopes enrollment lookups to that contract.
 *  - `variant` + `variantCandidateRuns`: when a non-default variant is
 *    selected, the function first looks for an existing enrollment whose run
 *    already matches the variant (preferred — the user is already enrolled).
 *    If none is found, it picks the best session from `variantCandidateRuns`
 *    via `selectVariantRunForCourse`. If that also returns nothing, it falls
 *    through to the default resolution below.
 *
 * Default resolution (no variant, or variant with no matching run):
 *  - Contract path: picks the best contract enrollment (by certificate then
 *    grade) and resolves its run.
 *  - Non-contract path: picks the best enrollment via the legacy display
 *    policy (certificate → grade → first match) and resolves the default next
 *    run.
 */
const resolveDisplayedRunAndEnrollment = (
  course: CourseWithCourseRunsSerializerV2,
  enrollments: CourseRunEnrollmentV3[],
  opts?: {
    contractId?: number
    variant?: SupportedVariant
    variantCandidateRuns?: BaseCourseRun[]
  },
): {
  displayedEnrollment: CourseRunEnrollmentV3 | null
  displayedRun: BaseCourseRun | null
} => {
  const scopedEnrollments =
    typeof opts?.contractId === "number"
      ? enrollments.filter((e) => e.b2b_contract_id === opts.contractId)
      : enrollments

  if (opts?.variant) {
    const matchesVariant = runMatchesVariant(opts.variant)

    // Prefer an existing enrollment whose run already matches the variant.
    const variantEnrollment =
      scopedEnrollments.find((e) => matchesVariant(e.run)) ?? null
    if (variantEnrollment) {
      const displayedRun =
        course.courseruns.find((r) => r.id === variantEnrollment.run.id) ??
        variantEnrollment.run
      return { displayedEnrollment: variantEnrollment, displayedRun }
    }

    // Not enrolled: pick the best candidate run from the API results.
    const bestRun = selectVariantRunForCourse(
      opts.variantCandidateRuns ?? [],
      opts.variant,
    )
    if (bestRun) {
      const displayedRun =
        course.courseruns.find((r) => r.id === bestRun.id) ?? bestRun
      return { displayedEnrollment: null, displayedRun }
    }

    // No matching run at all — fall through to default resolution.
  }

  if (typeof opts?.contractId === "number") {
    const defaultRun =
      getBestRun(course, { enrollableOnly: true }) ??
      course.courseruns[0] ??
      null
    const displayedEnrollment = selectBestEnrollment(course, scopedEnrollments)
    const runForResolution = displayedEnrollment
      ? ((course.courseruns ?? []).find(
          (run) => run.id === displayedEnrollment.run.id,
        ) ?? null)
      : defaultRun

    const displayedRun = synthesizeDisplayedRun(
      course,
      runForResolution,
      displayedEnrollment,
      opts.contractId,
    )

    return { displayedEnrollment, displayedRun }
  }

  const defaultRun =
    getBestRun(course, { enrollableOnly: true }) ?? course.courseruns[0] ?? null
  const matchedEnrollment =
    enrollments.find(
      (e) =>
        e.run &&
        (e.run.id === defaultRun?.id ||
          e.run.courseware_id === defaultRun?.courseware_id),
    ) ?? null
  const displayedEnrollment = pickDisplayedEnrollmentForLegacyDashboard(
    course,
    enrollments,
  )

  const displayedRun = synthesizeDisplayedRun(
    course,
    defaultRun,
    matchedEnrollment,
  )

  return { displayedEnrollment, displayedRun }
}

/**
 * Dashboard's display title for a requirement section operator node.
 *
 * Display policy owned by the dashboard — NOT by the shared parser
 * (`parseProgramRequirementSections`). The shared parser returns `rawTitle`
 * (null when absent); this function layers the fallback copy on top.
 *
 * Title precedence:
 * 1. `node.data.title` — explicit title wins
 * 2. elective + `min_number_of` + numeric `operator_value` → "Electives (Complete N)"
 * 3. elective (any other config) → "Elective Courses"
 * 4. default → "Core Courses"
 */
const getRequirementSectionTitle = (node: V2ProgramRequirement): string => {
  if (node.data.title) {
    return node.data.title
  }
  if (node.data.elective_flag) {
    if (node.data.operator === "min_number_of" && node.data.operator_value) {
      return `Electives (Complete ${node.data.operator_value})`
    }
    return "Elective Courses"
  }
  return "Core Courses"
}

/**
 * A single item in a requirement section — a discriminated union of three kinds.
 *
 * Terminology note: `item` refers to any arm of this union (heterogeneous);
 * `entry` refers specifically to the `DashboardCourseEntry` resolved for the
 * `course` arm (the only arm with language / contract / enrollment complexity).
 * The other two arms are not `DashboardCourseEntry`-shaped and are intentionally
 * left as lighter structs.
 */
type RequirementSectionItem =
  | { kind: "course"; entry: DashboardCourseEntry }
  | {
      kind: "program-as-course"
      courseProgram: V2ProgramDetail
      moduleCourses: CourseWithCourseRunsSerializerV2[]
      courseProgramEnrollment?: V3UserProgramEnrollment
    }
  | { kind: "program-enrollment"; enrollment: V3UserProgramEnrollment }

/**
 * A fully-resolved requirement section for the program dashboard.
 *
 * Carries `node` (the source operator from `req_tree`) because the dashboard
 * feeds it to `getRequirementsProgress(V2ProgramRequirement[])` for progress
 * counts — a dashboard-internal need. It is distinct from the shared
 * structure-only `ProgramRequirementSection` (which carries `node` as a
 * back-reference but has no display/completion data).
 */
type RequirementSection = {
  key: string | number | null | undefined
  title: string
  node: V2ProgramRequirement
  items: RequirementSectionItem[]
  completed: number
  total: number
}

/**
 * Build a fully-resolved `DashboardCourseEntry` for a single course.
 *
 * This is a pure constructor — it assembles the entry from caller-supplied
 * metadata and delegates all display-resolution to
 * `resolveDisplayedRunAndEnrollment`. The caller is responsible for:
 *  - pre-filtering `enrollments` to this course (e.g. `enrollmentsByCourseId[course.id] ?? []`)
 *  - computing `availableVariants` once at the composer level (NOT re-derived here)
 *  - supplying the effective `selectedVariantKey` (a valid option or fallback)
 *
 * `enrollments` is stored uncollapsed on the entry — the full list, never
 * filtered to the displayed choice.
 *
 * When `opts.variant` and `opts.variantCandidateRuns` are provided,
 * `resolveDisplayedRunAndEnrollment` will prefer any existing enrollment that
 * already matches the variant before falling back to the candidate runs.
 */
const buildCourseEntry = (
  course: CourseWithCourseRunsSerializerV2,
  enrollments: CourseRunEnrollmentV3[],
  opts: {
    contractId?: number
    isContractPageResource?: boolean
    ancestorContext?: DashboardCourseEntry["ancestorContext"]
    /** Active variant selection, when a non-default variant is chosen. */
    variant?: SupportedVariant
    /** Candidate runs from the variant-runs API for this course. */
    variantCandidateRuns?: BaseCourseRun[]
  },
): DashboardCourseEntry => {
  const { displayedRun, displayedEnrollment } =
    resolveDisplayedRunAndEnrollment(course, enrollments, {
      contractId: opts.contractId,
      variant: opts.variant,
      variantCandidateRuns: opts.variantCandidateRuns,
    })

  return {
    course,
    enrollments,
    contractId: opts.contractId,
    isContractPageResource: opts.isContractPageResource,
    ancestorContext: opts.ancestorContext,
    displayedEnrollment,
    displayedRun,
  }
}

type BuildRequirementSectionsArgs = {
  /**
   * The program's `req_tree`. Assumes a flat structure: operators are never
   * nested inside operators; direct children of each operator are leaves
   * (`node_type: "course"` or `"program"`). See `getRequirementsProgress`
   * for the same assumption and rationale.
   */
  reqTree: V2ProgramRequirement[]
  /** All courses belonging to the program (fetched once by the composer). */
  programCourses: CourseWithCourseRunsSerializerV2[]
  /** Course-run enrollments keyed by course id (pre-grouped by the composer). */
  enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]>
  /** Program enrollments keyed by program id (pre-grouped by the composer). */
  programEnrollmentsById: Record<number, V3UserProgramEnrollment>
  /** Nested programs referenced in `req_tree` (fetched by the composer). */
  requiredPrograms: V2ProgramDetail[]
  /**
   * Module courses for each required program (keyed by program id). Used to
   * wire `program-as-course` items. Pre-derived by the composer via
   * `groupModuleCoursesByProgramId`.
   */
  requiredProgramModuleCoursesByProgramId: Record<
    number,
    CourseWithCourseRunsSerializerV2[]
  >
  /**
   * The top-level program's own enrollment (from `programEnrollmentsById`).
   * When present, placed on every course arm's `ancestorContext.programEnrollment`.
   */
  ancestorProgramEnrollment?: V3UserProgramEnrollment
}

/**
 * Build the requirement sections for the program dashboard.
 *
 * Composes `parseProgramRequirementSections` for the structural parse, then
 * layers dashboard-only enrichment: entity resolution (course/program lookups),
 * the three-arm `RequirementSectionItem` discriminated union, section title
 * display copy (via `getRequirementSectionTitle`), and per-section + overall
 * progress counts (via `getRequirementsProgress`).
 *
 * Assumes a flat `req_tree`: operators are never nested inside operators.
 * See `getRequirementsProgress` for the same assumption and rationale.
 *
 * Preserves `req_tree` ordering. Sections with no resolved items are filtered
 * out (oracle: `.filter(section => section.items.length > 0)`).
 * Overall counts are computed over the filtered sections' nodes (not the full
 * `req_tree`) to match the oracle exactly.
 */
const buildRequirementSections = ({
  reqTree,
  programCourses,
  enrollmentsByCourseId,
  programEnrollmentsById,
  requiredPrograms,
  requiredProgramModuleCoursesByProgramId,
  ancestorProgramEnrollment,
}: BuildRequirementSectionsArgs): {
  sections: RequirementSection[]
  completedCount: number
  totalCount: number
} => {
  const coursesById = new Map(programCourses.map((c) => [c.id, c]))
  const programsById = new Map(requiredPrograms.map((p) => [p.id, p]))

  const parsedSections: ProgramRequirementSection[] =
    parseProgramRequirementSections(reqTree)

  const sections: RequirementSection[] = parsedSections
    .map((section) => {
      const items: RequirementSectionItem[] = section.items
        .map((resource): RequirementSectionItem | null => {
          if (resource.type === "course") {
            const course = coursesById.get(resource.id)
            if (!course) return null
            return {
              kind: "course",
              entry: buildCourseEntry(
                course,
                enrollmentsByCourseId[course.id] ?? [],
                {
                  ancestorContext: ancestorProgramEnrollment
                    ? { programEnrollment: ancestorProgramEnrollment }
                    : undefined,
                },
              ),
            }
          }

          // resource.type === "program"
          const program = programsById.get(resource.id)
          if (!program) return null

          if (isProgramAsCourse(program)) {
            return {
              kind: "program-as-course",
              courseProgram: program,
              moduleCourses:
                requiredProgramModuleCoursesByProgramId[program.id] ?? [],
              courseProgramEnrollment: programEnrollmentsById[program.id],
            }
          }

          const enrollment = programEnrollmentsById[program.id]
          if (!enrollment) return null

          return { kind: "program-enrollment", enrollment }
        })
        .filter((item): item is RequirementSectionItem => item !== null)

      const { completed, total } = getRequirementsProgress(
        [section.node],
        enrollmentsByCourseId,
        programEnrollmentsById,
      )

      return {
        key: section.id,
        title: getRequirementSectionTitle(section.node),
        node: section.node,
        items,
        completed,
        total,
      }
    })
    .filter((section) => section.items.length > 0)

  const { completed: completedCount, total: totalCount } =
    getRequirementsProgress(
      sections.map((s) => s.node),
      enrollmentsByCourseId,
      programEnrollmentsById,
    )

  return { sections, completedCount, totalCount }
}

const getProgramsInCollections = (
  collections: V2ProgramCollection[],
): Set<number> => {
  return new Set(
    collections.flatMap((collection) =>
      collection.programs
        .map((program) => program.id)
        .filter((id): id is number => id !== undefined),
    ),
  )
}

const programHasContractRuns = (
  program: V2Program,
  contractCourseIds: Set<number>,
): boolean => {
  return program.courses.some((courseId) => contractCourseIds.has(courseId))
}

const getSortedStandaloneContractPrograms = (
  programs: V2Program[],
  collections: V2ProgramCollection[],
  contract: ContractPage,
  contractCourses: CourseWithCourseRunsSerializerV2[],
): V2Program[] => {
  if (!contract.programs || contract.programs.length === 0) {
    return []
  }

  const contractProgramIds = new Set(contract.programs)
  const programsInCollections = getProgramsInCollections(collections)
  const contractCourseIds = new Set(contractCourses.map((course) => course.id))
  // Precompute sort order map: O(m) once, not O(n*m) per sort
  const programOrder = new Map(
    contract.programs.map((id, index) => [id, index]),
  )

  return programs
    .filter((program) => !programsInCollections.has(program.id))
    .filter((program) => contractProgramIds.has(program.id))
    .filter((program) => programHasContractRuns(program, contractCourseIds))
    .sort((a, b) => {
      const indexA = programOrder.get(a.id) ?? Infinity
      const indexB = programOrder.get(b.id) ?? Infinity
      return indexA - indexB
    })
}

/**
 * Filter `collections` to those the contract dashboard should render.
 *
 * A collection is renderable when **both** conditions hold:
 *  1. At least one of the collection's programs appears in `contract.programs`
 *     (i.e. the collection is relevant to this contract).
 *  2. At least one of the collection's programs has at least one course that
 *     belongs to the contract (via `programHasContractRuns`), so the card list
 *     will not be empty.
 *
 * If the contract has no programs at all, returns `[]` immediately.
 */
const getRenderableContractCollections = (
  collections: V2ProgramCollection[],
  programs: V2Program[],
  contract: ContractPage,
  contractCourses: CourseWithCourseRunsSerializerV2[],
): V2ProgramCollection[] => {
  if (!contract.programs || contract.programs.length === 0) {
    return []
  }

  const contractProgramIds = new Set(contract.programs)
  const contractCourseIds = new Set(contractCourses.map((course) => course.id))
  const programsById = new Map(programs.map((program) => [program.id, program]))

  return collections.filter((collection) => {
    const collectionProgramIds = collection.programs
      .map((program) => program.id)
      .filter((id): id is number => id !== undefined)

    const hasProgramInContract = collectionProgramIds.some((id) =>
      contractProgramIds.has(id),
    )
    if (!hasProgramInContract) {
      return false
    }

    return collectionProgramIds.some((id) => {
      const program = programsById.get(id)
      return program
        ? programHasContractRuns(program, contractCourseIds)
        : false
    })
  })
}

// ---------------------------------------------------------------------------
// Variant picker model
// ---------------------------------------------------------------------------

const VARIANT_INDUSTRY_LABELS: Record<string, string> = {
  E: "Energy",
  F: "Finance",
  HC: "Healthcare",
}

const VARIANT_LENGTH_LABELS: Record<string, string> = {
  S: "Short",
  F: "Full",
}

const FALLBACK_NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  ar: "العربية",
  de: "Deutsch",
  en: "English",
  es: "español",
  "es-419": "español (Latinoamérica)",
  fr: "français",
  hi: "हिन्दी",
  it: "italiano",
  ja: "日本語",
  ko: "한국어",
  pt: "português",
  "pt-br": "português (Brasil)",
  ru: "русский",
  zh: "中文",
  "zh-cn": "简体中文",
  "zh-tw": "繁體中文",
}

const nativeLanguageNameCache = new Map<string, string>()
let cachedDisplayNamesRef: typeof Intl.DisplayNames | undefined =
  Intl.DisplayNames

const ensureNativeLanguageNameCacheIsFresh = (): void => {
  if (Intl.DisplayNames !== cachedDisplayNamesRef) {
    cachedDisplayNamesRef = Intl.DisplayNames
    nativeLanguageNameCache.clear()
  }
}

const getFallbackNativeLanguageName = (languageCode: string): string | null => {
  const exactMatch = FALLBACK_NATIVE_LANGUAGE_NAMES[languageCode]
  if (exactMatch) {
    return exactMatch
  }
  const baseLanguageSubtag = languageCode.split("-")[0]
  if (!baseLanguageSubtag) {
    return null
  }
  return (
    FALLBACK_NATIVE_LANGUAGE_NAMES[baseLanguageSubtag] ?? baseLanguageSubtag
  )
}

const getNativeLanguageName = (languageCode: string): string => {
  ensureNativeLanguageNameCacheIsFresh()
  const normalizedLanguageCode = languageCode
    .trim()
    .toLowerCase()
    .replace("_", "-")
  const baseLanguageSubtag = normalizedLanguageCode.split("-")[0]
  const cachedLabel = nativeLanguageNameCache.get(normalizedLanguageCode)
  if (cachedLabel) {
    return cachedLabel
  }
  let resolvedLabel: string | null = null
  try {
    if (typeof Intl.DisplayNames === "function") {
      const displayNames = new Intl.DisplayNames([normalizedLanguageCode], {
        type: "language",
      })
      const label = displayNames.of(normalizedLanguageCode)
      if (label && label.toLowerCase() !== normalizedLanguageCode) {
        resolvedLabel = label
      }
      if (
        !resolvedLabel &&
        baseLanguageSubtag &&
        baseLanguageSubtag !== normalizedLanguageCode
      ) {
        const baseLabel = displayNames.of(baseLanguageSubtag)
        if (baseLabel && baseLabel.toLowerCase() !== baseLanguageSubtag) {
          resolvedLabel = baseLabel
        }
      }
    }
  } catch {
    // Fall through to static fallback labels.
  }
  const finalLabel =
    resolvedLabel ??
    getFallbackNativeLanguageName(normalizedLanguageCode) ??
    normalizedLanguageCode
  nativeLanguageNameCache.set(normalizedLanguageCode, finalLabel)
  return finalLabel
}

const buildVariantKey = (variant: SupportedVariant): string =>
  `language:${variant.language ?? ""}|industry:${variant.variant_industry ?? ""}|length:${variant.variant_length ?? ""}`

const buildVariantLabel = (variant: SupportedVariant): string => {
  const langLabel = variant.language
    ? getNativeLanguageName(variant.language)
    : ""
  const modifiers: string[] = []
  if (variant.variant_industry) {
    modifiers.push(
      VARIANT_INDUSTRY_LABELS[variant.variant_industry] ??
        variant.variant_industry,
    )
  } else {
    modifiers.push("General")
  }
  if (variant.variant_length) {
    modifiers.push(
      VARIANT_LENGTH_LABELS[variant.variant_length] ?? variant.variant_length,
    )
  } else {
    modifiers.push("Full")
  }
  return [langLabel, ...modifiers].filter(Boolean).join(" • ")
}

/**
 * Returns true when a run exactly matches all three fields of a variant.
 * Empty string is treated as a literal value (not a wildcard): a run with
 * `variant_industry = null` maps to `""` (general), so selecting
 * `(de, "", "")` matches only general-industry runs, not healthcare ones.
 */
const runMatchesVariant =
  (variant: SupportedVariant) =>
  (run: BaseCourseRun): boolean =>
    variant.language === (run.language ?? "") &&
    variant.variant_industry === (run.variant_industry ?? "") &&
    variant.variant_length === (run.variant_length ?? "")

/**
 * Given the list of runs returned by `api/v3/courses/variant_runs/` for one
 * course, return the single best run that exactly matches the selected variant
 * combination (language, industry, length). All three fields are matched
 * literally — `""` means "general/unset", not wildcard.
 *
 * If no run matches, returns `null`, signalling to the caller that it should
 * fall back to the course's `next_run_id`-based default.
 *
 * Among matching runs, enrollable runs are preferred first; within each
 * tier, runs are sorted by start date descending (most recent first); runs
 * with no start date are last.
 */
const selectVariantRunForCourse = (
  runs: BaseCourseRun[],
  selectedVariant: SupportedVariant,
): BaseCourseRun | null => {
  const matching = runs.filter(runMatchesVariant(selectedVariant))

  if (matching.length === 0) return null

  return (
    [...matching].sort((a, b) => {
      // Enrollable runs first
      const aEnrollable = a.is_enrollable ? 0 : 1
      const bEnrollable = b.is_enrollable ? 0 : 1
      if (aEnrollable !== bEnrollable) return aEnrollable - bEnrollable

      // Within each tier: descending by start date, nulls last
      const aMs = a.start_date ? new Date(a.start_date).getTime() : null
      const bMs = b.start_date ? new Date(b.start_date).getTime() : null
      if (aMs !== null && bMs !== null) return bMs - aMs
      if (aMs !== null) return -1
      if (bMs !== null) return 1
      return 0
    })[0] ?? null
  )
}

const getProgramCoursesInContractOrder = (
  program: V2Program,
  contractCourses: CourseWithCourseRunsSerializerV2[],
): CourseWithCourseRunsSerializerV2[] => {
  const contractCoursesById = new Map(
    contractCourses.map((course) => [course.id, course]),
  )
  return program.courses
    .map((courseId) => contractCoursesById.get(courseId))
    .filter((course): course is CourseWithCourseRunsSerializerV2 => !!course)
}

const getCollectionFirstCoursesInDisplayOrder = (
  collection: V2ProgramCollection,
  programs: V2Program[],
  contractCourses: CourseWithCourseRunsSerializerV2[],
): CourseWithCourseRunsSerializerV2[] => {
  const programsById = new Map(programs.map((program) => [program.id, program]))
  const contractCoursesById = new Map(
    contractCourses.map((course) => [course.id, course]),
  )
  const contractCourseIds = new Set(contractCourses.map((course) => course.id))

  const firstCourses = collection.programs
    .slice()
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
    .map((collectionProgram) => {
      if (typeof collectionProgram.id !== "number") {
        return null
      }
      const program = programsById.get(collectionProgram.id)
      if (!program) {
        return null
      }
      const firstCourseId = program.courses.find((courseId) =>
        contractCourseIds.has(courseId),
      )
      return typeof firstCourseId === "number"
        ? (contractCoursesById.get(firstCourseId) ?? null)
        : null
    })
    .filter((course): course is CourseWithCourseRunsSerializerV2 => !!course)

  const seenCourseIds = new Set<number>()
  return firstCourses.filter((course) => {
    if (seenCourseIds.has(course.id)) {
      return false
    }
    seenCourseIds.add(course.id)
    return true
  })
}

export {
  pickDisplayedEnrollmentForLegacyDashboard,
  groupCourseRunEnrollmentsByCourseId,
  groupProgramEnrollmentsByProgramId,
  resolveDisplayedRunAndEnrollment,
  isProgramAsCourse,
  isNonContractEnrollment,
  enrollmentCourseIsInPrograms,
  getNonContractProgramEnrollments,
  getTopLevelProgramEnrollments,
  getModuleCourseIdsFromPrograms,
  groupModuleCoursesByProgramId,
  bucketAndSortHomeEnrollments,
  assembleHomeCardList,
  buildCourseEntry,
  buildRequirementSections,
  programHasContractRuns,
  getSortedStandaloneContractPrograms,
  getRenderableContractCollections,
  getProgramCoursesInContractOrder,
  getCollectionFirstCoursesInDisplayOrder,
  buildVariantKey,
  buildVariantLabel,
  selectVariantRunForCourse,
}

export type { RequirementSectionItem, RequirementSection }
