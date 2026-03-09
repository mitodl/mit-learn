import { queryOptions } from "@tanstack/react-query"
import type {
  PaginatedV2ProgramCollectionList,
  PaginatedV2ProgramDetailList,
  ProgramCollectionsApiProgramCollectionsListRequest,
  ProgramsApiProgramsListV2Request,
  ProgramsApiProgramsRetrieveV2Request,
  V2Program,
} from "@mitodl/mitxonline-api-axios/v2"
import { programCollectionsApi, programsApi } from "../../clients"

const programsKeys = {
  root: ["mitxonline", "programs"],
  programDetail: (opts: ProgramsApiProgramsRetrieveV2Request) => [
    ...programsKeys.root,
    "detail",
    opts,
  ],
  programsList: (opts?: ProgramsApiProgramsListV2Request) => [
    ...programsKeys.root,
    "list",
    opts,
  ],
  programCollectionsList: (
    opts?: ProgramCollectionsApiProgramCollectionsListRequest,
  ) => [...programsKeys.root, "collections", "list", opts],
}

const programsQueries = {
  programDetail: (opts: ProgramsApiProgramsRetrieveV2Request) =>
    queryOptions({
      queryKey: programsKeys.programDetail(opts),
      queryFn: async (): Promise<V2Program> => {
        return programsApi.programsRetrieveV2(opts).then((res) => res.data)
      },
    }),
  programsList: (opts: ProgramsApiProgramsListV2Request) =>
    queryOptions({
      queryKey: programsKeys.programsList(opts),
      queryFn: async (): Promise<PaginatedV2ProgramDetailList> => {
        return programsApi.programsListV2(opts).then((res) => res.data)
      },
    }),
}

const programCollectionQueries = {
  programCollectionsList: (
    opts: ProgramCollectionsApiProgramCollectionsListRequest,
  ) =>
    queryOptions({
      queryKey: programsKeys.programCollectionsList(opts),
      queryFn: async (): Promise<PaginatedV2ProgramCollectionList> => {
        return programCollectionsApi
          .programCollectionsList(opts)
          .then((res) => res.data)
      },
    }),
}

export { programsQueries, programCollectionQueries, programsKeys }
