import { queryOptions } from "@tanstack/react-query"
import type {
  B2bApiB2bContractsRetrieveRequest,
  ContractPage,
} from "@mitodl/mitxonline-api-axios/v2"

import { b2bApi } from "../../clients"

const contractKeys = {
  root: ["mitxonline", "contracts"],
  contractsList: () => [...contractKeys.root, "list"],
  contractDetail: (opts: B2bApiB2bContractsRetrieveRequest) => [
    ...contractKeys.root,
    "detail",
    opts,
  ],
}

const contractQueries = {
  contractsList: () =>
    queryOptions({
      queryKey: contractKeys.contractsList(),
      queryFn: async (): Promise<ContractPage[]> => {
        return b2bApi.b2bContractsList().then((res) => res.data)
      },
    }),
  contractDetail: (opts: B2bApiB2bContractsRetrieveRequest) =>
    queryOptions({
      queryKey: contractKeys.contractDetail(opts),
      queryFn: async (): Promise<ContractPage> => {
        return b2bApi.b2bContractsRetrieve(opts).then((res) => res.data)
      },
    }),
}

export { contractQueries, contractKeys }
