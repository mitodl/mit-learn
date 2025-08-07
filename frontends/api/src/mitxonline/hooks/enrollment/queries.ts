import { queryOptions } from "@tanstack/react-query"
import type { CourseRunEnrollment } from "@mitodl/mitxonline-api-axios/v2"

import { courseRunEnrollmentsApi } from "../../clients"

const enrollmentKeys = {
  root: ["mitxonline", "enrollments"],
  courseRunEnrollmentsList: () => [
    ...enrollmentKeys.root,
    "courseRunEnrollments",
    "list",
  ],
  programEnrollmentsList: () => [
    ...enrollmentKeys.root,
    "programEnrollments",
    "list",
  ],
}

const enrollmentQueries = {
  courseRunEnrollmentsList: () =>
    queryOptions({
      queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      queryFn: async (): Promise<CourseRunEnrollment[]> => {
        return courseRunEnrollmentsApi.enrollmentsList().then((res) => res.data)
      },
    }),
}

export { enrollmentQueries, enrollmentKeys }
