/**
 * Composes the queries and pure-model helpers that drive the "My Learning"
 * (home) dashboard. Home is enrollment-flat: one card per enrollment, no
 * slot collapse. The hook returns bucket data (started / notStarted /
 * completed / expired) plus the auxiliary lookups the renderer needs for
 * program-as-course module data.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type {
  CourseRunEnrollmentV3,
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { programsQueries } from "api/mitxonline-hooks/programs"
import {
  bucketAndSortHomeEnrollments,
  enrollmentCourseIsInPrograms,
  getModuleCourseIdsFromPrograms,
  getNonContractProgramEnrollments,
  getTopLevelProgramEnrollments,
  groupCourseRunEnrollmentsByCourseId,
  groupModuleCoursesByProgramId,
  isNonContractEnrollment,
  isProgramAsCourse,
} from "../model/dashboardViewModel"

type HomeDashboardData = {
  started: CourseRunEnrollmentV3[]
  notStarted: CourseRunEnrollmentV3[]
  completed: CourseRunEnrollmentV3[]
  expired: CourseRunEnrollmentV3[]
  programEnrollments: V3UserProgramEnrollment[]
  enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]>
  courseProgramsById: Map<number, V2ProgramDetail>
  moduleCoursesByProgramId: Record<number, CourseWithCourseRunsSerializerV2[]>
  isLoading: boolean
}

const useHomeDashboardData = (): HomeDashboardData => {
  const { data: enrolledCourses, isLoading: courseEnrollmentsLoading } =
    useQuery(enrollmentQueries.courseRunEnrollmentsList())
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    ...mitxUserQueries.me(),
    select: (user) => user.b2b_organizations.flatMap((org) => org.contracts),
  })
  const { data: programEnrollments, isLoading: programEnrollmentsLoading } =
    useQuery(enrollmentQueries.programEnrollmentsList())

  const nonContractProgramEnrollments =
    contracts && programEnrollments
      ? getNonContractProgramEnrollments(programEnrollments, contracts)
      : []
  const enrolledProgramIds = nonContractProgramEnrollments.map(
    (enrollment) => enrollment.program.id,
  )

  const { data: enrolledPrograms, isLoading: enrolledProgramsLoading } =
    useQuery({
      ...programsQueries.programsList({
        id: enrolledProgramIds,
        page_size: enrolledProgramIds.length,
      }),
      enabled: enrolledProgramIds.length > 0,
      placeholderData: keepPreviousData,
    })

  const enrolledProgramsResults = enrolledPrograms?.results ?? []
  const homeCoursePrograms = enrolledProgramsResults.filter(isProgramAsCourse)
  const homeCourseProgramModuleIds =
    getModuleCourseIdsFromPrograms(homeCoursePrograms)

  const {
    data: homeCourseProgramModuleCourses,
    isLoading: homeModuleCoursesLoading,
  } = useQuery({
    ...coursesQueries.coursesList({
      id: homeCourseProgramModuleIds,
      page_size: homeCourseProgramModuleIds.length || undefined,
    }),
    enabled: homeCourseProgramModuleIds.length > 0,
    placeholderData: keepPreviousData,
  })

  const isCovered = enrollmentCourseIsInPrograms(enrolledProgramsResults)
  const homeEnrollments = (enrolledCourses ?? [])
    .filter(isNonContractEnrollment)
    .filter((enrollment) => !isCovered(enrollment))
  const buckets = bucketAndSortHomeEnrollments(homeEnrollments)

  return {
    ...buckets,
    programEnrollments: getTopLevelProgramEnrollments(
      nonContractProgramEnrollments,
      enrolledProgramsResults,
    ),
    enrollmentsByCourseId: groupCourseRunEnrollmentsByCourseId(
      enrolledCourses ?? [],
    ),
    courseProgramsById: new Map(homeCoursePrograms.map((p) => [p.id, p])),
    moduleCoursesByProgramId: groupModuleCoursesByProgramId(
      homeCoursePrograms,
      homeCourseProgramModuleCourses?.results ?? [],
    ),
    isLoading:
      courseEnrollmentsLoading ||
      programEnrollmentsLoading ||
      contractsLoading ||
      enrolledProgramsLoading ||
      homeModuleCoursesLoading,
  }
}

export { useHomeDashboardData }
