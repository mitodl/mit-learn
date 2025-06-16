import { enrollmentQueries, enrollmentKeys } from "./queries"
import { enrollmentMutations } from "./mutations"
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

export {
  enrollmentQueries,
  enrollmentMutations,
  enrollmentKeys,
  useDestroyEnrollment,
}
