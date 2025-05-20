import { B2bApiB2bOrganizationsRetrieveRequest } from "@mitodl/mitxonline-api-axios/v0"
import { OrganizationPage } from "@mitodl/mitxonline-api-axios/v1"
import { queryOptions } from "@tanstack/react-query"
import { b2bApi } from "../../clients"

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

export { organizationQueries, organizationKeys }
