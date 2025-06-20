import { enrollmentQueries, enrollmentKeys } from "./queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { enrollmentsApi } from "../../clients"
import { EnrollmentsApiEnrollmentsPartialUpdateRequest } from "@mitodl/mitxonline-api-axios/v1"

const useUpdateEnrollment = (
  opts: EnrollmentsApiEnrollmentsPartialUpdateRequest,
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => enrollmentsApi.enrollmentsPartialUpdate(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.enrollmentsList(),
      })
    },
  })
}

const useDestroyEnrollment = (enrollmentId: number) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => enrollmentsApi.enrollmentsDestroy({ id: enrollmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.enrollmentsList(),
      })
    },
  })
}

export {
  enrollmentQueries,
  enrollmentKeys,
  useUpdateEnrollment,
  useDestroyEnrollment,
}
