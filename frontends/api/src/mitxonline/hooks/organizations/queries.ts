import { queryOptions } from "@tanstack/react-query"
import { b2bApi } from "../../clients"
import {
  OrganizationPage,
  ManagerContractDetail,
  PaginatedManagerEnrollmentCodeList,
  B2bApiB2bOrganizationsRetrieveRequest,
  B2bApiB2bManagerOrganizationsContractsRetrieveRequest,
  B2bApiB2bManagerOrganizationsContractsCodesListRequest,
} from "@mitodl/mitxonline-api-axios/v2"

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
  contractCodesRoot: () =>
    ["mitxonline", "manager", "organizations", "contracts", "codes"] as const,
  contractCodes: (
    opts: B2bApiB2bManagerOrganizationsContractsCodesListRequest,
  ) => [...managerOrganizationKeys.contractCodesRoot(), opts] as const,
  // Prefix key used for invalidation — matches all pages/search states for one contract
  contractCodesForContract: (id: number, orgId: number) =>
    managerOrganizationKeys.contractCodes({
      id,
      parent_lookup_organization: orgId,
    }),
}

const managerOrganizationQueries = {
  managerOrganizationsList: () =>
    queryOptions({
      queryKey: managerOrganizationKeys.list(),
      queryFn: async (): Promise<OrganizationPage[]> =>
        b2bApi.b2bManagerOrganizationsList().then((res) => res.data.results),
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
    opts: B2bApiB2bManagerOrganizationsContractsCodesListRequest,
  ) =>
    queryOptions({
      queryKey: managerOrganizationKeys.contractCodes(opts),
      queryFn: async (): Promise<PaginatedManagerEnrollmentCodeList> =>
        b2bApi
          .b2bManagerOrganizationsContractsCodesList(opts)
          .then((res) => res.data),
    }),
}

export {
  organizationQueries,
  organizationKeys,
  managerOrganizationQueries,
  managerOrganizationKeys,
}

