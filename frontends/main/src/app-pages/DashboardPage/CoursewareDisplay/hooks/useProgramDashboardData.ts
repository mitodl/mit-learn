import React from "react"
import { useQuery } from "@tanstack/react-query"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { programsQueries } from "api/mitxonline-hooks/programs"
import type { CourseRunEnrollmentV3 } from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { getIdsFromReqTree } from "@/common/mitxonline"
import {
  groupCourseRunEnrollmentsByCourseId,
  groupProgramEnrollmentsByProgramId,
  groupModuleCoursesByProgramId,
  buildRequirementSections,
  getCertificateLink,
} from "../model/dashboardViewModel"
import type { RequirementSection } from "../model/dashboardViewModel"

export type ProgramDashboardData = {
  sections: RequirementSection[]
  programTitle: string | undefined
  programType: string | null | undefined
  programCertificateUrl: string | null
  completedCount: number
  totalCount: number
  enrolledInProgram: boolean
  isLoading: boolean
  /** Shared aux: course-run enrollments keyed by course id. Used by
   * non-course arms (program-as-course) that need the dashboard-wide
   * enrollment map from the component level. */
  enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]>
  /** Shared aux: pre-derived ancestor program enrollment shape for
   * `ProgramAsCourseCard`. Identical across all program-as-course items
   * in this dashboard (one top-level program per view). */
  ancestorProgramEnrollment:
    | { readable_id: string; enrollment_mode?: string | null }
    | undefined
}

/**
 * Data composer for the program dashboard.
 *
 * Fetches the 6 program-dashboard queries (course-run enrollments,
 * programDetail, program enrollments, program courses, required programs,
 * required program-courses) and composes the pure helpers in
 * `dashboardViewModel.ts` into the durable returned contract:
 * requirement sections with per-section counts, language picker state,
 * overall completion counts, and shared aux for non-course arms.
 *
 * Pure transforms are unit-tested in `dashboardViewModel.test.ts`; this
 * hook's query→helper wiring is tested in `useProgramDashboardData.test.tsx`.
 */
const useProgramDashboardData = (programId: number): ProgramDashboardData => {
  // --- 6 program-dashboard queries ---

  const { data: rawEnrollments, isLoading: userEnrollmentsLoading } = useQuery(
    enrollmentQueries.courseRunEnrollmentsList(),
  )

  const { data: program, isLoading: programLoading } = useQuery(
    programsQueries.programDetail({ id: programId.toString() }),
  )

  const { data: programEnrollments, isLoading: programEnrollmentsLoading } =
    useQuery(enrollmentQueries.programEnrollmentsList())

  // --- query-input derivations (inline fetch wiring, not domain logic) ---

  const enrolledInProgram = programEnrollments?.some(
    (e) => e.program.id === program?.id,
  )

  const programEnrollment = programEnrollments?.find(
    (e) => e.program.id === program?.id,
  )

  const { data: programCourses, isLoading: programCoursesLoading } = useQuery({
    ...coursesQueries.coursesList({
      id: program?.courses || [],
      page_size: program?.courses?.length || undefined,
    }),
    enabled: !!program && program.courses.length > 0 && enrolledInProgram,
  })

  const requiredProgramIds = React.useMemo(() => {
    if (!program?.req_tree) return []
    return [...new Set(getIdsFromReqTree(program.req_tree).programIds)]
  }, [program?.req_tree])

  const { data: requiredPrograms, isLoading: requiredProgramsLoading } =
    useQuery({
      ...programsQueries.programsList({
        id: requiredProgramIds,
        page_size: requiredProgramIds.length || undefined,
      }),
      enabled: Boolean(enrolledInProgram && requiredProgramIds.length > 0),
    })

  const requiredProgramList = React.useMemo(
    () => requiredPrograms?.results ?? [],
    [requiredPrograms?.results],
  )

  const programAsCourseCourseIds = React.useMemo(() => {
    const uniqueIds = new Set<number>()
    requiredProgramList
      .filter(
        (requiredProgram) =>
          requiredProgram.display_mode === DisplayModeEnum.Course,
      )
      .forEach((requiredProgram) => {
        requiredProgram.courses?.forEach((courseId) => uniqueIds.add(courseId))
      })
    return [...uniqueIds]
  }, [requiredProgramList])

  const {
    data: requiredProgramCourses,
    isLoading: requiredProgramCoursesLoading,
  } = useQuery({
    ...coursesQueries.coursesList({
      id: programAsCourseCourseIds,
      page_size: programAsCourseCourseIds.length || undefined,
    }),
    enabled: Boolean(enrolledInProgram && programAsCourseCourseIds.length > 0),
  })

  const isLoading =
    userEnrollmentsLoading ||
    programLoading ||
    programEnrollmentsLoading ||
    programCoursesLoading ||
    requiredProgramsLoading ||
    requiredProgramCoursesLoading

  // --- compose named helpers ---

  const enrollmentsByCourseId = groupCourseRunEnrollmentsByCourseId(
    rawEnrollments ?? [],
  )

  const programEnrollmentsById = groupProgramEnrollmentsByProgramId(
    programEnrollments ?? [],
  )

  const allProgramCourses = programCourses?.results ?? []

  const requiredProgramModuleCoursesByProgramId = groupModuleCoursesByProgramId(
    requiredProgramList,
    requiredProgramCourses?.results ?? [],
  )

  const { sections, completedCount, totalCount } = buildRequirementSections({
    reqTree: program?.req_tree ?? [],
    programCourses: allProgramCourses,
    enrollmentsByCourseId,
    programEnrollmentsById,
    requiredPrograms: requiredProgramList,
    requiredProgramModuleCoursesByProgramId,
    ancestorProgramEnrollment: programEnrollment,
  })

  // --- shared aux for non-course arms ---

  const ancestorProgramEnrollment: ProgramDashboardData["ancestorProgramEnrollment"] =
    programEnrollment
      ? {
          readable_id: programEnrollment.program.readable_id,
          enrollment_mode: programEnrollment.enrollment_mode,
        }
      : undefined

  const programCertificateUrl = getCertificateLink(
    programEnrollment?.certificate?.link,
    "program",
  )

  return {
    sections,
    programTitle: program?.title,
    programType: program?.program_type,
    programCertificateUrl,
    completedCount,
    totalCount,
    enrolledInProgram: Boolean(enrolledInProgram),
    isLoading,
    enrollmentsByCourseId,
    ancestorProgramEnrollment,
  }
}

export { useProgramDashboardData }
