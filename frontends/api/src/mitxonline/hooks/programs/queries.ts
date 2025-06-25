import { queryOptions } from "@tanstack/react-query"
import type {
  PaginatedV2ProgramList,
  ProgramsApiProgramsListV2Request,
} from "@mitodl/mitxonline-api-axios/v1"
import { programsApi } from "../../clients"

const programsKeys = {
  root: ["mitxonline", "programs"],
  programsList: (opts?: ProgramsApiProgramsListV2Request) => [
    ...programsKeys.root,
    "list",
    opts,
  ],
}

const programsQueries = {
  programsList: (opts: ProgramsApiProgramsListV2Request) =>
    queryOptions({
      queryKey: programsKeys.programsList(opts),
      queryFn: async (): Promise<PaginatedV2ProgramList> => {
        return programsApi.programsListV2(opts).then((res) => res.data)
      },
    }),
}

export { programsQueries, programsKeys }
