import { queryOptions } from "@tanstack/react-query"
import type { CourseRunEnrollment } from "../../generated/v0"

import * as data from "./data"
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
        if (process.env.NODE_ENV === "test") {
          /**
           * For now, only use the API client during tests so we
           * can mock it the way we normally do.
           */
          return enrollmentsApi.enrollmentsList().then((res) => res.data)
        }
        await new Promise((resolve) => setTimeout(resolve, 300))
        return data.enrollments
      },
    }),
}

export { enrollmentQueries, enrollmentKeys }
