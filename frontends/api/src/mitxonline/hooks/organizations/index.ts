import { useMutation, useQueryClient } from "@tanstack/react-query"
import { b2bApi } from "../../clients"
import {
  B2bApiB2bAttachCreateRequest,
  B2bApiB2bManagerOrganizationsContractsCodesBulkAssignCreateRequest,
  B2bApiB2bManagerOrganizationsContractsCodesReassignUpdateRequest,
  B2bApiB2bManagerOrganizationsContractsCodesRemindCreateRequest,
  B2bApiB2bManagerOrganizationsContractsCodesRevokeDestroyRequest,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  organizationQueries,
  managerOrganizationQueries,
  managerOrganizationKeys,
} from "./queries"

const useB2BAttachMutation = (opts: B2bApiB2bAttachCreateRequest) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const response = await b2bApi.b2bAttachCreate(opts)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mitxonline"] })
    },
  })
}

/**
 * Bulk-assign available enrollment codes to a list of email addresses. Codes are
 * auto-allocated by the backend (one per record); the response reports which
 * addresses were assigned and which failed.
 */
const useBulkAssignSeats = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      opts: B2bApiB2bManagerOrganizationsContractsCodesBulkAssignCreateRequest,
    ) => b2bApi.b2bManagerOrganizationsContractsCodesBulkAssignCreate(opts),
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: managerOrganizationKeys.contractCodesForContract(
          vars.id,
          vars.parent_lookup_organization,
        ),
      })
    },
  })
}

/** Resend the claim email for an assigned-but-unredeemed enrollment code. */
const useRemindCode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      opts: B2bApiB2bManagerOrganizationsContractsCodesRemindCreateRequest,
    ) => b2bApi.b2bManagerOrganizationsContractsCodesRemindCreate(opts),
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: managerOrganizationKeys.contractCodesForContract(
          vars.id,
          vars.parent_lookup_organization,
        ),
      })
    },
  })
}

/** Revoke a code assignment, returning the code to the unassigned pool. */
const useRevokeCode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      opts: B2bApiB2bManagerOrganizationsContractsCodesRevokeDestroyRequest,
    ) => b2bApi.b2bManagerOrganizationsContractsCodesRevokeDestroy(opts),
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: managerOrganizationKeys.contractCodesForContract(
          vars.id,
          vars.parent_lookup_organization,
        ),
      })
    },
  })
}

/**
 * Reassign an assigned-but-unredeemed enrollment code to a new email address.
 * The backend updates the existing assignment in place and re-sends the claim
 * email. Returns 409 if the code has already been redeemed.
 */
const useReassignCode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      opts: B2bApiB2bManagerOrganizationsContractsCodesReassignUpdateRequest,
    ) => b2bApi.b2bManagerOrganizationsContractsCodesReassignUpdate(opts),
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: managerOrganizationKeys.contractCodesForContract(
          vars.id,
          vars.parent_lookup_organization,
        ),
      })
    },
  })
}

export {
  organizationQueries,
  managerOrganizationQueries,
  useB2BAttachMutation,
  useBulkAssignSeats,
  useReassignCode,
  useRemindCode,
  useRevokeCode,
}
export type { ContractCode, PaginatedContractCodes } from "./queries"
