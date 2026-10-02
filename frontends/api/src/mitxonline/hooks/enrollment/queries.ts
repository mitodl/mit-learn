import { queryOptions } from "@tanstack/react-query"
import type {
  CourseRunEnrollmentV3,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"

import { courseRunEnrollmentsApi, programEnrollmentsApi } from "../../clients"
import { RawAxiosRequestConfig } from "axios"

type CourseRunEnrollmentsListOpts = { exclude_b2b?: boolean }

const enrollmentKeys = {
  root: ["mitxonline", "enrollments"],
  // Filtered variants extend the unfiltered key, so invalidating the
  // unfiltered key refreshes them too.
  courseRunEnrollmentsList: (opts?: CourseRunEnrollmentsListOpts) => [
    ...enrollmentKeys.root,
    "courseRunEnrollments",
    "list",
    ...(opts ? [opts] : []),
  ],
  programEnrollmentsList: (opts?: RawAxiosRequestConfig) => [
    ...enrollmentKeys.root,
    "programEnrollments",
    "list",
    opts,
  ],
}

const enrollmentQueries = {
  courseRunEnrollmentsList: (opts?: CourseRunEnrollmentsListOpts) =>
    queryOptions({
      queryKey: enrollmentKeys.courseRunEnrollmentsList(opts),
      queryFn: async (): Promise<CourseRunEnrollmentV3[]> => {
        return courseRunEnrollmentsApi
          .userEnrollmentsListV3(opts)
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
