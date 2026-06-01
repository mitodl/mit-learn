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

  // Map courseId → all candidate BaseCourseRuns the API returned for the
  // selected variant.  Empty when the default (Original) variant is active.
  //
  // The API may return a mix of runs matching the selected variant and the
  // course's default variant.  resolveDisplayedRunAndEnrollment (called inside
  // buildCourseEntry) is responsible for: preferring any existing enrollment
  // whose run already matches the variant, then picking the best candidate
  // session from this list, then falling back to default run resolution.
  const variantRunsByCourseId = React.useMemo<
    Record<number, BaseCourseRun[]>
  >(() => {
    if (isDefaultVariantSelection || !variantRunsQuery.data) return {}
    const map: Record<number, BaseCourseRun[]> = {}
    for (const courseVariantRuns of variantRunsQuery.data) {
      map[courseVariantRuns.id] = courseVariantRuns.courseruns
    }
    return map
  }, [isDefaultVariantSelection, variantRunsQuery.data])

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

  const programRows = sortedPrograms.map((program) => {
    const courses = getProgramCoursesInContractOrder(program, contractCourses)
    const programEnrollment = programEnrollmentsById[program.id]
    return {
      program,
      entries: courses.map((course) =>
        buildCourseEntry(course, enrollmentsByCourseId[course.id] ?? [], {
          contractId: contract.id,
          ancestorContext: programEnrollment
            ? { programEnrollment }
            : undefined,
          variant: isDefaultVariantSelection ? undefined : selectedVariant!,
          variantCandidateRuns: isDefaultVariantSelection
            ? undefined
            : variantRunsByCourseId[course.id],
        }),
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
        buildCourseEntry(course, enrollmentsByCourseId[course.id] ?? [], {
          contractId: contract.id,
          variant: isDefaultVariantSelection ? undefined : selectedVariant!,
          variantCandidateRuns: isDefaultVariantSelection
            ? undefined
            : variantRunsByCourseId[course.id],
        }),
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
