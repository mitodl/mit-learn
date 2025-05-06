import { queryOptions } from "@tanstack/react-query"
import type { CourseRunEnrollment } from "@mitodl/mitxonline-api-axios/v1"

// import { axiosInstance } from "../../clients"
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

        // if (process.env.NODE_ENV === "test") {
        //   /**
        //    * ALERT! This is a temporary solution while API is under development.
        //    *
        //    * Ideally we would use the real API client here:
        //    * `enrollmentsApi.enrollmentsList(opts)`
        //    *
        //    * However, we are relying on yet-to-be-implemented query parameters
        //    * (namely, orgId).
        //    *
        //    * The generated client ignores unsupported query parameters, which
        //    * inhibits testing.
        //    */
        //   const urls = await import("../../test-utils/urls")
        //   return axiosInstance
        //     .request({
        //       url: urls.enrollment.courseEnrollment(opts),
        //       method: "GET",
        //     })
        //     .then((res) => res.data)
        // }
        // await new Promise((resolve) => setTimeout(resolve, 300))
        // if (opts.orgId === dataForOrgs.orgData.orgX.id) {
        //   return dataForOrgs.orgXEnrollments.map((enrollment) => ({
        //     ...enrollment,
        //     enrollment_mode: enrollment.enrollment_mode as EnrollmentModeEnum,
        //   }))
        // }
        // if (opts.orgId === dataForOrgs.orgData.orgY.id) {
        //   return dataForOrgs.orgYEnrollments.map((enrollment) => ({
        //     ...enrollment,
        //     enrollment_mode: enrollment.enrollment_mode as EnrollmentModeEnum,
        //   }))
        // }
        // if (opts.orgId) {
        //   console.error(`No data for orgId ${opts.orgId}`)
        //   return []
        // }
        // return data.enrollments
      },
    }),
}

export { enrollmentQueries, enrollmentKeys }
export type { EnrollmentsListOptions }
