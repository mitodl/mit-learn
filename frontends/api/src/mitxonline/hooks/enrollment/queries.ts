import { queryOptions } from "@tanstack/react-query"
import type { CourseRunEnrollment } from "../../generated/v0"

import * as data from "./data"
import { enrollmentsApi } from "../../clients"

const enrollmentKeys = {
  root: ["mitxonline", "enrollments"],
  coursesList: () => [...enrollmentKeys.root, "courses", "list"],
}

const enrollmentQueries = {
  coursesList: () =>
    queryOptions({
      queryKey: enrollmentKeys.coursesList(),
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
