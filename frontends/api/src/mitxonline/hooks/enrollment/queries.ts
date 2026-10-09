import { queryOptions } from "@tanstack/react-query"
import type {
  CourseRunEnrollmentV3,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v3"

import { courseRunEnrollmentsV3Api, programEnrollmentsApi } from "../../clients"
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
      queryFn: async (): Promise<CourseRunEnrollmentV3[]> => {
        return courseRunEnrollmentsV3Api
          .userEnrollmentsListV3()
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
