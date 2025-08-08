import { enrollmentQueries, enrollmentKeys } from "./queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { b2bApi, courseRunEnrollmentsApi } from "../../clients"
import {
  B2bApiB2bEnrollCreateRequest,
  EnrollmentsApiEnrollmentsPartialUpdateRequest,
} from "@mitodl/mitxonline-api-axios/v2"

const useCreateEnrollment = (opts: B2bApiB2bEnrollCreateRequest) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => b2bApi.b2bEnrollCreate(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      })
    },
  })
}

const useUpdateEnrollment = (
  opts: EnrollmentsApiEnrollmentsPartialUpdateRequest,
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => courseRunEnrollmentsApi.enrollmentsPartialUpdate(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      })
    },
  })
}

const useDestroyEnrollment = (enrollmentId: number) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      courseRunEnrollmentsApi.enrollmentsDestroy({ id: enrollmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      })
    },
  })
}

export {
  enrollmentQueries,
  enrollmentKeys,
  useCreateEnrollment,
  useUpdateEnrollment,
  useDestroyEnrollment,
}
