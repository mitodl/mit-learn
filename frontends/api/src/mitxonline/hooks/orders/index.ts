import { orderQueries, orderKeys } from "./queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ordersApi } from "../../clients"
import type { RefundRequestRequest } from "@mitodl/mitxonline-api-axios/v2"
import type { MutationHookOptions } from "../../../mutations/mutationMeta"

/**
 * Submit a learner's refund request for an order.
 *
 * Invalidates the order's receipt, since a successful request moves its
 * `refund_status` to `requested` and the card rendering it has to follow.
 */
const useCreateRefundRequest = ({ meta }: MutationHookOptions = {}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (opts: RefundRequestRequest) =>
      ordersApi.ordersRefundRequestsCreate({ RefundRequestRequest: opts }),
    onSettled: (_data, _error, opts) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.receipt(opts.order),
      })
    },
    meta,
  })
}

export { orderQueries, orderKeys, useCreateRefundRequest }
