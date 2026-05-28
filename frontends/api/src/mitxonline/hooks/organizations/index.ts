import { useMutation, useQueryClient } from "@tanstack/react-query"
import { b2bApi } from "../../clients"
import { B2bApiB2bAttachCreateRequest } from "@mitodl/mitxonline-api-axios/v2"
import { organizationQueries, managerOrganizationQueries } from "./queries"

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

export { organizationQueries, managerOrganizationQueries, useB2BAttachMutation }
export type { ContractCode } from "./queries"
