import { faker } from "@faker-js/faker/locale/en"
import type { Order, TransactionLine } from "@mitodl/mitxonline-api-axios/v2"

const transactionLine = (
  overrides: Partial<TransactionLine> = {},
): TransactionLine => ({
  quantity: 1,
  CEUs: "0.0",
  content_title: faker.company.catchPhrase(),
  content_type: "",
  readable_id: `course-v1:MITxT+${faker.string.alphanumeric(6)}`,
  start_date: faker.date.past().toISOString(),
  end_date: faker.date.future().toISOString(),
  total_paid: faker.commerce.price({ min: 50, max: 500 }),
  discount: "0.00",
  price: faker.commerce.price({ min: 50, max: 500 }),
  ...overrides,
})

const order = (overrides: Partial<Order> = {}): Order => ({
  id: faker.number.int(),
  state: "fulfilled",
  purchaser: [],
  total_price_paid: faker.commerce.price({ min: 50, max: 500 }),
  lines: [transactionLine()],
  discounts: [],
  refunds: [],
  reference_number: faker.string.alphanumeric(10),
  created_on: faker.date.past().toISOString(),
  transactions: {},
  street_address: {},
  ...overrides,
})

export { order, transactionLine }
