import { enrollmentQueries, enrollmentKeys } from "./queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { b2bApi, enrollmentsApi } from "../../clients"
import {
  B2bApiB2bEnrollCreateRequest,
  EnrollmentsApiEnrollmentsPartialUpdateRequest,
} from "@mitodl/mitxonline-api-axios/v1"

const useCreateEnrollment = (opts: B2bApiB2bEnrollCreateRequest) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => b2bApi.b2bEnrollCreate(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: enrollmentKeys.enrollmentsList(),
      })
    },
  })
}

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
  useCreateEnrollment,
  useUpdateEnrollment,
  useDestroyEnrollment,
}
