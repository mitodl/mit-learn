import { enrollmentQueries, enrollmentKeys } from "./queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { enrollmentsApi } from "../../clients"

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

export { enrollmentQueries, enrollmentKeys, useDestroyEnrollment }
