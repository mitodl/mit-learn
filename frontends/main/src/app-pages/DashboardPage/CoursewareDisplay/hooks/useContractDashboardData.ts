import React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  programsQueries,
  programCollectionQueries,
} from "api/mitxonline-hooks/programs"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { useDashboardVariantPicker } from "./useDashboardVariantPicker"
import type {
  BaseCourseRun,
  ContractPage,
  CourseRunEnrollmentV3,
  OrganizationPage,
  SupportedVariant,
  V2Program,
  V2ProgramCollection,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  buildCourseEntry,
  getCollectionFirstCoursesInDisplayOrder,
  getProgramCoursesInContractOrder,
  getRenderableContractCollections,
  getSortedStandaloneContractPrograms,
  groupCourseRunEnrollmentsByCourseId,
  groupProgramEnrollmentsByProgramId,
  selectVariantRunForCourse,
  type DashboardCourseEntry,
} from "../model/dashboardViewModel"

type ContractProgramDisplayData = {
  program: V2Program
  entries: DashboardCourseEntry[]
  programEnrollment?: V3UserProgramEnrollment
}

type ContractCollectionDisplayData = {
  collection: V2ProgramCollection
  entries: DashboardCourseEntry[]
}

type ContractDashboardData = {
  isLoading: boolean
  showNoPrograms: boolean
  variantOptions: SupportedVariant[]
  selectedVariant: SupportedVariant | null
  setSelectedVariant: (variant: SupportedVariant | null) => void
  programs: ContractProgramDisplayData[]
  collections: ContractCollectionDisplayData[]
  courseRunEnrollments: CourseRunEnrollmentV3[]
  programEnrollmentsById: Record<number, V3UserProgramEnrollment>
}

const useContractDashboardData = (
  org: OrganizationPage,
  contract: ContractPage,
): ContractDashboardData => {
  const courseRunEnrollmentsQuery = useQuery(
    enrollmentQueries.courseRunEnrollmentsList(),
  )
  const programEnrollmentsQuery = useQuery(
    enrollmentQueries.programEnrollmentsList(),
  )
  const programsQuery = useQuery(
    programsQueries.programsList({
      org_id: org.id,
      contract_id: contract.id,
      page_size: 30,
    }),
  )
  const programCollectionsQuery = useQuery(
    programCollectionQueries.programCollectionsList({}),
  )
  const coursesQuery = useQuery(
    coursesQueries.coursesList({
      org_id: org.id,
      contract_id: contract.id,
      page_size: 200,
    }),
  )

  const contractCourses = React.useMemo(
    () => coursesQuery.data?.results ?? [],
    [coursesQuery.data?.results],
  )
  const courseRunEnrollments = courseRunEnrollmentsQuery.data ?? []

  const variantOptions = React.useMemo(
    () => contract.variant_options ?? [],
    [contract],
  )

  const { selectedVariant, setSelectedVariant } =
    useDashboardVariantPicker(variantOptions)

  const isDefaultVariantSelection =
    selectedVariant === null || selectedVariant.default_variant

  // Lazy second-phase query: only fires when a non-default variant is selected.
  // Returns one entry per course with the matching variant run(s).
  const variantRunsQuery = useQuery({
    ...coursesQueries.courseVariantRunsList({
      contract: contract.id,
      course_id: contractCourses.map((c) => c.id),
      language: selectedVariant?.language || undefined,
      industry: selectedVariant?.variant_industry || undefined,
      length: selectedVariant?.variant_length || undefined,
    }),
    enabled: !isDefaultVariantSelection && contractCourses.length > 0,
  })

  // Map courseId → best BaseCourseRun for the selected variant.
  // Empty when the default (Original) variant is active.
  //
  // The API returns all runs for a course that match either the selected
  // variant OR the course's default variant (so the array can hold multiple
  // sessions and/or a mix of variant types).  We therefore filter to runs
  // that explicitly match every non-empty field of the selected variant and
  // pick the best session among those.  Courses with no matching run are
  // absent from the map, which causes buildCourseEntry to fall back to
  // next_run_id via the null variantRun path.
  const variantRunsByCourseId = React.useMemo<
    Record<number, BaseCourseRun>
  >(() => {
    if (isDefaultVariantSelection || !variantRunsQuery.data) return {}
    if (!selectedVariant) return {}
    const map: Record<number, BaseCourseRun> = {}
    for (const courseVariantRuns of variantRunsQuery.data) {
      const best = selectVariantRunForCourse(
        courseVariantRuns.courseruns,
        selectedVariant,
      )
      if (best) {
        map[courseVariantRuns.id] = best
      }
    }
    return map
  }, [isDefaultVariantSelection, selectedVariant, variantRunsQuery.data])

  const programs = programsQuery.data?.results ?? []
  const collections = programCollectionsQuery.data?.results ?? []
  const sortedPrograms = getSortedStandaloneContractPrograms(
    programs,
    collections,
    contract,
    contractCourses,
  )

  const renderableCollections = getRenderableContractCollections(
    collections,
    programs,
    contract,
    contractCourses,
  )

  const programEnrollmentsById = groupProgramEnrollmentsByProgramId(
    programEnrollmentsQuery.data ?? [],
  )

  const enrollmentsByCourseId =
    groupCourseRunEnrollmentsByCourseId(courseRunEnrollments)

  // Derive per-course language key from the selected variant for enrollment
  // matching in the language-based resolution path.
  const selectedVariantKey =
    selectedVariant?.language && !selectedVariant.default_variant
      ? `language:${selectedVariant.language}`
      : ""

  const programRows = sortedPrograms.map((program) => {
    const courses = getProgramCoursesInContractOrder(program, contractCourses)
    const programEnrollment = programEnrollmentsById[program.id]
    return {
      program,
      entries: courses.map((course) =>
        buildCourseEntry(
          course,
          enrollmentsByCourseId[course.id] ?? [],
          selectedVariantKey,
          {
            availableVariants: variantOptions,
            contractId: contract.id,
            ancestorContext: programEnrollment
              ? { programEnrollment }
              : undefined,
            variantRun: isDefaultVariantSelection
              ? undefined
              : (variantRunsByCourseId[course.id] ?? null),
          },
        ),
      ),
      programEnrollment,
    }
  })

  const collectionRows = renderableCollections.map((collection) => {
    const firstCourses = getCollectionFirstCoursesInDisplayOrder(
      collection,
      programs,
      contractCourses,
    )
    return {
      collection,
      entries: firstCourses.map((course) =>
        buildCourseEntry(
          course,
          enrollmentsByCourseId[course.id] ?? [],
          selectedVariantKey,
          {
            availableVariants: variantOptions,
            contractId: contract.id,
            variantRun: isDefaultVariantSelection
              ? undefined
              : (variantRunsByCourseId[course.id] ?? null),
          },
        ),
      ),
    }
  })

  return {
    isLoading:
      courseRunEnrollmentsQuery.isLoading ||
      programEnrollmentsQuery.isLoading ||
      programsQuery.isLoading ||
      programCollectionsQuery.isLoading ||
      coursesQuery.isLoading,
    showNoPrograms: programRows.length === 0 && collectionRows.length === 0,
    variantOptions,
    selectedVariant,
    setSelectedVariant,
    programs: programRows,
    collections: collectionRows,
    courseRunEnrollments,
    programEnrollmentsById,
  }
}

export { useContractDashboardData }
export type {
  ContractDashboardData,
  ContractProgramDisplayData,
  ContractCollectionDisplayData,
}
