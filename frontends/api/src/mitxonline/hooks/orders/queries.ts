import { queryOptions } from "@tanstack/react-query"
import { ordersApi } from "../../clients"
import type { Order } from "@mitodl/mitxonline-api-axios/v2"

const orderKeys = {
  root: ["mitxonline", "orders"],
  receipt: (orderId: number) => [...orderKeys.root, "receipt", orderId],
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
}

export { orderQueries, orderKeys }
