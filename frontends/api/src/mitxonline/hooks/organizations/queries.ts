import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { b2bApi } from "../../clients"
import {
  OrganizationPage,
  B2bApiB2bAttachCreateRequest,
  B2bApiB2bOrganizationsRetrieveRequest,
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

const useB2BAttachMutation = (opts: B2bApiB2bAttachCreateRequest) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => b2bApi.b2bAttachCreate(opts),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.organizationsRetrieve(),
      })
    },
  })
}

export { organizationQueries, organizationKeys, useB2BAttachMutation }
