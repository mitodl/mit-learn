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
    mutationFn: async () => {
      const response = await b2bApi.b2bAttachCreate(opts)
      // 200 (already attached) indicates user already attached to all contracts
      // 201 (successfully attached) is success
      // 404 (invalid or expired code) will be thrown as error by axios
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mitxonline"] })
    },
  })
}

export { organizationQueries, organizationKeys, useB2BAttachMutation }
