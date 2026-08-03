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
   * The authenticated user's order history, most recent first.
   *
   * MITx Online does not expose the order that paid for a given enrollment, so
   * this is how we resolve a course run or program back to its order (see
   * `useOrderIdForRun` / `useOrderIdForProgram`).
   */
  historyList: (opts: OrdersApiOrdersHistoryListRequest = {}) =>
    queryOptions({
      queryKey: orderKeys.historyList(opts),
      queryFn: async (): Promise<PaginatedOrderHistoryList> => {
        return ordersApi.ordersHistoryList(opts).then((res) => res.data)
      },
    }),
}

export { orderQueries, orderKeys }
