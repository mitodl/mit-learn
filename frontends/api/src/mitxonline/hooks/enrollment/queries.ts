import { queryOptions } from "@tanstack/react-query"
import type { CourseRunEnrollment } from "@mitodl/mitxonline-api-axios/v1"

import { enrollmentsApi } from "../../clients"
import { RawAxiosRequestConfig } from "axios"

const enrollmentKeys = {
  root: ["mitxonline", "enrollments"],
  enrollmentsList: (opts: RawAxiosRequestConfig) => [
    ...enrollmentKeys.root,
    "programEnrollments",
    "list",
    opts,
  ],
}

const enrollmentQueries = {
  enrollmentsList: (opts: RawAxiosRequestConfig) =>
    queryOptions({
      queryKey: enrollmentKeys.enrollmentsList(opts),
      queryFn: async (): Promise<CourseRunEnrollment[]> => {
        return enrollmentsApi.enrollmentsList(opts).then((res) => res.data)
      },
    }),
}

export { enrollmentQueries, enrollmentKeys }
