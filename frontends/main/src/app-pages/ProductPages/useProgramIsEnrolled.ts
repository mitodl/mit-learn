import { useQuery } from "@tanstack/react-query"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { useUserIsAuthenticated } from "api/hooks/user"

/**
 * Whether the authenticated user is enrolled in THIS program.
 * Auth-gated: the enrollments query only runs when the user is authenticated.
 */
const useProgramIsEnrolled = (
  program: V2ProgramDetail,
): {
  isEnrolled: boolean
  isLoading: boolean
  isError: boolean
} => {
  const isAuthenticated = useUserIsAuthenticated()

  const enrollments = useQuery({
    ...enrollmentQueries.programEnrollmentsList(),
    enabled: isAuthenticated,
    throwOnError: false,
  })

  if (!isAuthenticated || !enrollments.data) {
    return {
      isEnrolled: false,
      isLoading: isAuthenticated ? enrollments.isLoading : false,
      isError: isAuthenticated ? enrollments.isError : false,
    }
  }

  const isEnrolled = enrollments.data.some(
    (enrollment) => enrollment.program.id === program.id,
  )

  return {
    isEnrolled,
    isLoading: enrollments.isLoading,
    isError: enrollments.isError,
  }
}

export { useProgramIsEnrolled }
