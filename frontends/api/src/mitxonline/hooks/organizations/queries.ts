import { queryOptions } from "@tanstack/react-query"
import { b2bApi } from "../../clients"
import {
  OrganizationPage,
  ManagerContractDetail,
  B2bApiB2bOrganizationsRetrieveRequest,
  B2bApiB2bManagerOrganizationsContractsRetrieveRequest,
  B2bApiB2bManagerOrganizationsContractsCodesRetrieveRequest,
} from "@mitodl/mitxonline-api-axios/v2"

type ContractCode = {
  id: number
  code: string
  is_redeemed: boolean
  redeemed_by: string | null
  redeemed_on: string | null
}

const organizationKeys = {
  root: ["mitxonline", "organizations"],
  organizationsRetrieve: (opts?: B2bApiB2bOrganizationsRetrieveRequest) => [
    ...organizationKeys.root,
    "retrieve",
    opts,
  ],
}

const organizationQueries = {
  organizationsRetrieve: (opts: B2bApiB2bOrganizationsRetrieveRequest) =>
    queryOptions({
      queryKey: organizationKeys.organizationsRetrieve(opts),
      queryFn: async (): Promise<OrganizationPage> => {
        return b2bApi.b2bOrganizationsRetrieve(opts).then((res) => res.data)
      },
    }),
}

const managerOrganizationKeys = {
  list: () => ["mitxonline", "manager", "organizations", "list"] as const,
  contractDetail: (
    opts: B2bApiB2bManagerOrganizationsContractsRetrieveRequest,
  ) =>
    [
      "mitxonline",
      "manager",
      "organizations",
      "contracts",
      "detail",
      opts,
    ] as const,
  contractCodes: (
    opts: B2bApiB2bManagerOrganizationsContractsCodesRetrieveRequest,
  ) =>
    [
      "mitxonline",
      "manager",
      "organizations",
      "contracts",
      "codes",
      opts,
    ] as const,
}

const managerOrganizationQueries = {
  managerOrganizationsList: () =>
    queryOptions({
      queryKey: managerOrganizationKeys.list(),
      queryFn: async (): Promise<OrganizationPage[]> =>
        b2bApi.b2bManagerOrganizationsList().then((res) => res.data),
    }),
  managerContractDetail: (
    opts: B2bApiB2bManagerOrganizationsContractsRetrieveRequest,
  ) =>
    queryOptions({
      queryKey: managerOrganizationKeys.contractDetail(opts),
      queryFn: async (): Promise<ManagerContractDetail> =>
        b2bApi
          .b2bManagerOrganizationsContractsRetrieve(opts)
          .then((res) => res.data),
    }),
  managerContractCodes: (
    opts: B2bApiB2bManagerOrganizationsContractsCodesRetrieveRequest,
  ) =>
    queryOptions({
      queryKey: managerOrganizationKeys.contractCodes(opts),
      queryFn: async (): Promise<ContractCode[]> =>
        b2bApi
          .b2bManagerOrganizationsContractsCodesRetrieve(opts)
          // The generated client types this endpoint as returning ManagerContractDetail,
          // but the actual API returns ContractCode[]. Cast until the package is updated.
          .then((res) => res.data as unknown as ContractCode[]),
    }),
}

export {
  organizationQueries,
  organizationKeys,
  managerOrganizationQueries,
  managerOrganizationKeys,
}

export type { ContractCode }
