import { queryOptions } from "@tanstack/react-query"
import type {
  CourseRunEnrollmentRequestV2,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"

import { courseRunEnrollmentsApi, programEnrollmentsApi } from "../../clients"
import { RawAxiosRequestConfig } from "axios"

const enrollmentKeys = {
  root: ["mitxonline", "enrollments"],
  courseRunEnrollmentsList: () => [
    ...enrollmentKeys.root,
    "courseRunEnrollments",
    "list",
  ],
  programEnrollmentsList: (opts?: RawAxiosRequestConfig) => [
    ...enrollmentKeys.root,
    "programEnrollments",
    "list",
    opts,
  ],
}

const enrollmentQueries = {
  courseRunEnrollmentsList: () =>
    queryOptions({
      queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      queryFn: async (): Promise<CourseRunEnrollmentRequestV2[]> => {
        return courseRunEnrollmentsApi
          .userEnrollmentsListV2()
          .then((res) => res.data)
      },
    }),
  programEnrollmentsList: (opts?: RawAxiosRequestConfig) =>
    queryOptions({
      queryKey: enrollmentKeys.programEnrollmentsList(opts),
      queryFn: async (): Promise<V3UserProgramEnrollment[]> => {
        return programEnrollmentsApi
          .v3ProgramEnrollmentsList(opts)
          .then((res) => res.data)
      },
    }),
}

export { enrollmentQueries, enrollmentKeys }
