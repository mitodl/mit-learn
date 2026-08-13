import { queryOptions } from "@tanstack/react-query"
import { ordersApi } from "../../clients"
import type {
  Order,
  OrdersApiOrdersHistoryListRequest,
  PaginatedOrderHistoryList,
} from "@mitodl/mitxonline-api-axios/v2"

const orderKeys = {
  root: ["mitxonline", "orders"],
  receipt: (orderId: number) => [...orderKeys.root, "receipt", orderId],
  historyList: (opts: OrdersApiOrdersHistoryListRequest) => [
    ...orderKeys.root,
    "history",
    opts,
  ],
}

const orderQueries = {
  receipt: (orderId: number) =>
    queryOptions({
      queryKey: orderKeys.receipt(orderId),
      queryFn: async (): Promise<Order> => {
        return ordersApi
          .ordersReceiptRetrieve({
            id: orderId,
          })
          .then((res) => res.data)
      },
    }),
  /**
   * Fulfilled and refunded orders, most recent first.
   *
   * Enrollments carry no reference to their order, so getting from a run or
   * program to its receipt means searching these lines — see
   * `useOrderIdForRun` / `useOrderIdForProgram`.
   *
   * `opts` is required rather than defaulted: older deployments drop the
   * pagination envelope when `limit` is absent and return a bare array, which
   * would not match the declared return type.
   */
  historyList: (opts: OrdersApiOrdersHistoryListRequest) =>
    queryOptions({
      queryKey: orderKeys.historyList(opts),
      queryFn: async (): Promise<PaginatedOrderHistoryList> => {
        return ordersApi.ordersHistoryList(opts).then((res) => res.data)
      },
    }),
}

export { orderQueries, orderKeys }
