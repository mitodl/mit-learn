import { queryOptions } from "@tanstack/react-query"
import type {
  CourseRunEnrollment,
  UserProgramEnrollmentDetail,
  ProgramEnrollmentsApiProgramEnrollmentsListRequest,
} from "@mitodl/mitxonline-api-axios/v2"

import { courseRunEnrollmentsApi, programEnrollmentsApi } from "../../clients"

const enrollmentKeys = {
  root: ["mitxonline", "enrollments"],
  courseRunEnrollmentsList: () => [
    ...enrollmentKeys.root,
    "courseRunEnrollments",
    "list",
  ],
  programEnrollmentsList: (
    opts?: ProgramEnrollmentsApiProgramEnrollmentsListRequest,
  ) => [...enrollmentKeys.root, "programEnrollments", "list", opts],
}

const enrollmentQueries = {
  courseRunEnrollmentsList: () =>
    queryOptions({
      queryKey: enrollmentKeys.courseRunEnrollmentsList(),
      queryFn: async (): Promise<CourseRunEnrollment[]> => {
        return courseRunEnrollmentsApi.enrollmentsList().then((res) => res.data)
      },
    }),
  programEnrollmentsList: (
    opts?: ProgramEnrollmentsApiProgramEnrollmentsListRequest,
  ) =>
    queryOptions({
      queryKey: enrollmentKeys.programEnrollmentsList(opts),
      queryFn: async (): Promise<UserProgramEnrollmentDetail[]> => {
        return programEnrollmentsApi
          .programEnrollmentsList(opts)
          .then((res) => res.data)
      },
    }),
}

export { enrollmentQueries, enrollmentKeys }
