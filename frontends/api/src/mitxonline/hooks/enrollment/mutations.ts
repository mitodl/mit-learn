import { enrollmentsApi } from "../../clients"

const enrollmentMutations = {
  destroyEnrollment: (id: number) => ({
    mutationFn: async (): Promise<void> => {
      return enrollmentsApi.enrollmentsDestroy({ id }).then((res) => res.data)
    },
  }),
}

export { enrollmentMutations }
