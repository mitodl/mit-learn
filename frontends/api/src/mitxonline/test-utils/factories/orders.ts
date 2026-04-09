import { faker } from "@faker-js/faker/locale/en"
import type { OrderReceipt, OrderReceiptLine } from "../../hooks/orders/queries"

const receiptLine = (
  overrides: Partial<OrderReceiptLine> = {},
): OrderReceiptLine => ({
  id: faker.number.int(),
  item_description: faker.company.catchPhrase(),
  quantity: 1,
  unit_price: "100.00",
  total_price: "100.00",
  product: {
    id: faker.number.int(),
    description: faker.commerce.productName(),
  },
  ...overrides,
})

const receipt = (overrides: Partial<OrderReceipt> = {}): OrderReceipt => ({
  purchaser: {},
  lines: [receiptLine()],
  coupon: null,
  order: {},
  receipt: {},
  ...overrides,
})

export { receipt, receiptLine }
