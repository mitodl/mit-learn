import React from "react"
import { useQuery } from "@tanstack/react-query"
import type { SimpleSelectOption } from "ol-components"
import {
  programsQueries,
  programCollectionQueries,
} from "api/mitxonline-hooks/programs"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import type {
  ContractPage,
  CourseRunEnrollmentV3,
  OrganizationPage,
  V2Program,
  V2ProgramCollection,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  buildContractCourseDisplaySlots,
  getCollectionFirstCoursesInDisplayOrder,
  getDistinctDashboardLanguageOptions,
  getProgramCoursesInContractOrder,
  getRenderableContractCollections,
  getSortedStandaloneContractPrograms,
  groupProgramEnrollmentsByProgramId,
  type ContractCourseDisplaySlot,
} from "../model/dashboardViewModel"

type ContractProgramDisplayData = {
  program: V2Program
  slots: ContractCourseDisplaySlot[]
  programEnrollment?: V3UserProgramEnrollment
}

type ContractCollectionDisplayData = {
  collection: V2ProgramCollection
  slots: ContractCourseDisplaySlot[]
}

type ContractDashboardData = {
  isLoading: boolean
  showNoPrograms: boolean
  languageOptions: SimpleSelectOption[]
  selectedLanguageKey: string
  setSelectedLanguageKey: (value: string) => void
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

  const languageOptions = React.useMemo(
    () =>
      getDistinctDashboardLanguageOptions(
        contractCourses,
        courseRunEnrollments,
        {
          contractId: contract.id,
        },
      ),
    [contract.id, contractCourses, courseRunEnrollments],
  )

  const [selectedLanguageKey, setSelectedLanguageKey] = React.useState("")

  // TODO: Move to shared useDashboardLanguagePicker once Phase 4 merges.
  React.useEffect(() => {
    if (languageOptions.length === 0) {
      if (selectedLanguageKey) {
        setSelectedLanguageKey("")
      }
      return
    }

    const hasSelectedLanguage = languageOptions.some(
      (option) => option.value === selectedLanguageKey,
    )
    if (!hasSelectedLanguage) {
      setSelectedLanguageKey(String(languageOptions[0].value))
    }
  }, [languageOptions, selectedLanguageKey])

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

  const programRows = sortedPrograms.map((program) => {
    const courses = getProgramCoursesInContractOrder(program, contractCourses)
    return {
      program,
      slots: buildContractCourseDisplaySlots(
        courses,
        courseRunEnrollments,
        selectedLanguageKey,
        contract.id,
      ),
      programEnrollment: programEnrollmentsById[program.id],
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
      slots: buildContractCourseDisplaySlots(
        firstCourses,
        courseRunEnrollments,
        selectedLanguageKey,
        contract.id,
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
    languageOptions,
    selectedLanguageKey,
    setSelectedLanguageKey,
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
