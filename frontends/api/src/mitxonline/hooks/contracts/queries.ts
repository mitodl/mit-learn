import { queryOptions } from "@tanstack/react-query"
import type {
  B2bApiB2bContractsRetrieveRequest,
  B2bApiB2bManagerOrganizationsContractsCodesRetrieveRequest,
  ContractPage,
  ManagerContractDetail,
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
  managerContractCodes: (
    opts: B2bApiB2bManagerOrganizationsContractsCodesRetrieveRequest,
  ) => [...contractKeys.root, "manager", "codes", opts],
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
  managerContractCodes: (
    opts: B2bApiB2bManagerOrganizationsContractsCodesRetrieveRequest,
  ) =>
    queryOptions({
      queryKey: contractKeys.managerContractCodes(opts),
      queryFn: async (): Promise<ManagerContractDetail> => {
        return b2bApi
          .b2bManagerOrganizationsContractsCodesRetrieve(opts)
          .then((res) => res.data)
      },
    }),
}

export { contractQueries, contractKeys }
