import { queryOptions } from "@tanstack/react-query"
import type {
  PaginatedV2ProgramList,
  ProgramsApiProgramsListV2Request,
} from "@mitodl/mitxonline-api-axios/v0"

// import * as data from "./data"
import { axiosInstance } from "../../clients"

type ProgramsListRequest = ProgramsApiProgramsListV2Request & {
  /**
   * NOT YET IMPLEMENTED
   */
  orgId?: number
}

const programsKeys = {
  root: ["mitxonline", "programs"],
  programsList: (opts?: ProgramsListRequest) => [
    ...programsKeys.root,
    "list",
    opts,
  ],
}

const programsQueries = {
  programsList: (opts: ProgramsListRequest) =>
    queryOptions({
      queryKey: programsKeys.programsList(opts),
      queryFn: async (): Promise<PaginatedV2ProgramList> => {
        const urls = await import("../../test-utils/urls")
        return axiosInstance
          .request({
            url: urls.programs.programsList(opts),
            method: "GET",
          })
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
        //       url: urls.programs.programsList(opts),
        //       method: "GET",
        //     })
        //     .then((res) => res.data)
        // }
        // return data.universalAiProgramData
      },
    }),
}

export { programsQueries, programsKeys }
export type { ProgramsListRequest }
