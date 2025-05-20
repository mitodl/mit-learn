import { queryOptions } from "@tanstack/react-query"
import type { CourseRunEnrollment } from "@mitodl/mitxonline-api-axios/v1"

import { AxiosRequestConfig } from "axios"
import { enrollmentsApi } from "../../clients"

type EnrollmentsListOptions = {
  /**
   * WARNING: This is not yet implemented in the API.
   */
  orgId?: number
}

const enrollmentKeys = {
  root: ["mitxonline", "enrollments"],
  coursesList: (opts?: EnrollmentsListOptions) => [
    ...enrollmentKeys.root,
    "courses",
    "list",
    opts,
  ],
}

const enrollmentQueries = {
  coursesList: (opts: EnrollmentsListOptions = {}) =>
    queryOptions({
      queryKey: enrollmentKeys.coursesList(opts),
      queryFn: async (): Promise<CourseRunEnrollment[]> => {
        const axiosConfig = { params: opts } as AxiosRequestConfig
        return enrollmentsApi
          .enrollmentsList(axiosConfig)
          .then((res) => res.data)
      },
    }),
}

export { enrollmentQueries, enrollmentKeys }
export type { EnrollmentsListOptions }
