import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  CourseRunEnrollmentV3,
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { programsQueries } from "api/mitxonline-hooks/programs"
import {
  assembleHomeCardList,
  type DashboardResource,
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

export type HomeDashboardData = {
  /** The ordered card list (started → … → expired) the home dashboard renders. */
  cards: DashboardResource[]
  /** How many of `cards` are visible before "Show all". */
  initiallyVisibleCount: number
  enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]>
  courseProgramsById: Map<number, V2ProgramDetail>
  moduleCoursesByProgramId: Record<number, CourseWithCourseRunsSerializerV2[]>
  isLoading: boolean
}

/**
 * Data composer for the "My Learning" home dashboard.
 *
 * Fetches the home queries (course-run enrollments, program enrollments,
 * enrolled programs, program-as-course module courses, the user's contracts)
 * and composes the pure helpers in `dashboardViewModel.ts` into render-ready
 * data: the ordered enrollment-flat card list with its initial visible count,
 * plus the lookups the renderer needs for program-as-course rows.
 *
 * Pure transforms are unit-tested in `dashboardViewModel.test.ts`; this hook's
 * query→helper wiring is tested in `useHomeDashboardData.test.tsx`.
 */
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
  const coursePrograms = enrolledProgramsResults.filter(isProgramAsCourse)
  const courseProgramModuleIds = getModuleCourseIdsFromPrograms(coursePrograms)

  const { data: courseProgramModuleCourses, isLoading: moduleCoursesLoading } =
    useQuery({
      ...coursesQueries.coursesList({
        id: courseProgramModuleIds,
        page_size: courseProgramModuleIds.length || undefined,
      }),
      enabled: courseProgramModuleIds.length > 0,
      placeholderData: keepPreviousData,
    })

  const isCovered = enrollmentCourseIsInPrograms(enrolledProgramsResults)
  const bucketableEnrollments = (enrolledCourses ?? [])
    .filter(isNonContractEnrollment)
    .filter((enrollment) => !isCovered(enrollment))
  const buckets = bucketAndSortHomeEnrollments(bucketableEnrollments)

  const programEnrollmentsToRender = enrolledPrograms
    ? getTopLevelProgramEnrollments(
        nonContractProgramEnrollments,
        enrolledProgramsResults,
      )
    : []

  return {
    ...assembleHomeCardList({
      ...buckets,
      programEnrollments: programEnrollmentsToRender,
    }),
    enrollmentsByCourseId: groupCourseRunEnrollmentsByCourseId(
      enrolledCourses ?? [],
    ),
    courseProgramsById: new Map(coursePrograms.map((p) => [p.id, p])),
    moduleCoursesByProgramId: groupModuleCoursesByProgramId(
      coursePrograms,
      courseProgramModuleCourses?.results ?? [],
    ),
    isLoading:
      courseEnrollmentsLoading ||
      programEnrollmentsLoading ||
      contractsLoading ||
      enrolledProgramsLoading ||
      moduleCoursesLoading,
  }
}

export { useHomeDashboardData }
