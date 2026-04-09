import { queryOptions } from "@tanstack/react-query"
import { axiosInstance } from "../../clients"

type OrderReceiptLine = {
  id: number
  item_description: string
  quantity: number
  unit_price: string
  total_price: string
  product: {
    id: number
    description: string | null
  }
}

type OrderReceipt = {
  purchaser: Record<string, unknown>
  lines: OrderReceiptLine[]
  coupon: Record<string, unknown> | null
  order: Record<string, unknown>
  receipt: Record<string, unknown>
}

const MITX_ONLINE_BASE_URL =
  process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL?.replace(/\/+$/, "") ?? ""

const orderKeys = {
  root: ["mitxonline", "orders"],
  receipt: (orderId: number) => [...orderKeys.root, "receipt", orderId],
}

const orderQueries = {
  receipt: (orderId: number) =>
    queryOptions({
      queryKey: orderKeys.receipt(orderId),
      queryFn: async (): Promise<OrderReceipt> => {
        const response = await axiosInstance.get<OrderReceipt>(
          `${MITX_ONLINE_BASE_URL}/api/v0/orders/receipt/${orderId}/`,
        )
        return response.data
      },
    }),
}

export { orderQueries, orderKeys }
export type { OrderReceipt, OrderReceiptLine }
