import { queryOptions } from "@tanstack/react-query"
import type { CourseRunEnrollment } from "../../generated/v0"

import * as data from "./data"

const enrollmentKeys = {
  root: ["mitxonline", "enrollments"],
  coursesList: () => [...enrollmentKeys.root, "courses", "list"],
}

const enrollmentQueries = {
  coursesList: () =>
    queryOptions({
      queryKey: enrollmentKeys.coursesList(),
      queryFn: async (): Promise<CourseRunEnrollment[]> => {
        await new Promise((resolve) => setTimeout(resolve, 300))
        return data.enrollments
      },
    }),
}

export { enrollmentQueries, enrollmentKeys }
