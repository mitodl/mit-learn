import { queryOptions } from "@tanstack/react-query"
import type { CourseRunEnrollment } from "@mitodl/mitxonline-api-axios/v2"

import { enrollmentsApi } from "../../clients"

const enrollmentKeys = {
  root: ["mitxonline", "enrollments"],
  enrollmentsList: () => [...enrollmentKeys.root, "programEnrollments", "list"],
}

const enrollmentQueries = {
  enrollmentsList: () =>
    queryOptions({
      queryKey: enrollmentKeys.enrollmentsList(),
      queryFn: async (): Promise<CourseRunEnrollment[]> => {
        return enrollmentsApi.enrollmentsList().then((res) => res.data)
      },
    }),
}

export { enrollmentQueries, enrollmentKeys }
