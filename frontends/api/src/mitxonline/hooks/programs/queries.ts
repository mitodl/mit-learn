import { queryOptions } from "@tanstack/react-query"
import type {
  PaginatedV2ProgramList,
  ProgramsApiProgramsListV2Request,
} from "../../generated/v0"

import * as data from "./data"
import { programsApi } from "../../clients"

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
        if (process.env.NODE_ENV === "test") {
          /**
           * For now, only use the API client during tests so we
           * can mock it the way we normally do.
           */
          return programsApi.programsListV2(opts).then((res) => res.data)
        }
        return data.universalAiProgramData
      },
    }),
}

export { programsQueries, programsKeys }
