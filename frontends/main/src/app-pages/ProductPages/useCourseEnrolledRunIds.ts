import { useQuery } from "@tanstack/react-query"
import type { CourseWithCourseRunsSerializerV2 } from "@mitodl/mitxonline-api-axios/v2"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { useUserIsAuthenticated } from "api/hooks/user"

/**
 * Returns the run ids for THIS course that the authenticated user is enrolled in.
 * Auth-gated: the enrollments query only runs when the user is authenticated.
 */
const useCourseEnrolledRunIds = (
  course: CourseWithCourseRunsSerializerV2,
): {
  runIds: number[]
  isLoading: boolean
  isError: boolean
} => {
  const isAuthenticated = useUserIsAuthenticated()
  const courseRunIds = new Set((course.courseruns ?? []).map((r) => r.id))

  const enrollments = useQuery({
    ...enrollmentQueries.courseRunEnrollmentsList(),
    enabled: isAuthenticated,
    throwOnError: false,
  })

  if (!isAuthenticated || !enrollments.data) {
    return {
      runIds: [],
      isLoading: isAuthenticated ? (enrollments.isLoading ?? false) : false,
      isError: isAuthenticated ? (enrollments.isError ?? false) : false,
    }
  }

  const runIds = enrollments.data
    .map((enrollment) => enrollment.run.id)
    .filter((id) => courseRunIds.has(id))

  return {
    runIds,
    isLoading: enrollments.isLoading,
    isError: enrollments.isError,
  }
}

export { useCourseEnrolledRunIds }
