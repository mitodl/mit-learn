import { faker } from "@faker-js/faker/locale/en"
import type {
  Line,
  Nested,
  Order,
  OrderHistory,
  OrderRefundsInner,
  OrderStreetAddress,
  OrderTransactions,
  PaginatedOrderHistoryList,
  Product,
  RedeemedDiscount,
  TransactionLine,
} from "@mitodl/mitxonline-api-axios/v2"

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

const orderTransactions = (
  overrides: Partial<OrderTransactions> = {},
): OrderTransactions => ({
  card_number: `xxxxxxxxxxxx${faker.string.numeric(4)}`,
  card_type: "Visa",
  name: faker.person.fullName(),
  bill_to_email: faker.internet.email(),
  payment_method: "card",
  ...overrides,
})

const orderStreetAddress = (
  overrides: Partial<OrderStreetAddress> = {},
): OrderStreetAddress => ({
  line: [faker.location.streetAddress()],
  postal_code: faker.location.zipCode(),
  state: faker.location.state({ abbreviated: true }),
  city: faker.location.city(),
  country: "US",
  ...overrides,
})

const redeemedDiscount = (
  overrides: Partial<Nested> = {},
): RedeemedDiscount => ({
  redeemed_discount: {
    id: faker.number.int(),
    created_on: faker.date.past().toISOString(),
    updated_on: faker.date.past().toISOString(),
    amount: faker.commerce.price({ min: 5, max: 50 }),
    discount_type: "dollars-off",
    redemption_type: "one-time",
    discount_code: faker.string.alphanumeric(12),
    ...overrides,
  },
})

const orderRefund = (
  overrides: Partial<OrderRefundsInner> = {},
): OrderRefundsInner => ({
  amount: Number(faker.commerce.price({ min: 5, max: 500 })),
  date: faker.date.past().toISOString(),
  ...overrides,
})

const order = (overrides: Partial<Order> = {}): Order => ({
  id: faker.number.int(),
  state: "fulfilled",
  purchaser: {
    country: "US",
    email: faker.internet.email(),
  },
  total_price_paid: faker.commerce.price({ min: 50, max: 500 }),
  lines: [transactionLine()],
  discounts: [],
  refunds: [],
  refund_eligible: false,
  reference_number: faker.string.alphanumeric(10),
  created_on: faker.date.past().toISOString(),
  transactions: orderTransactions(),
  street_address: orderStreetAddress(),
  refund_eligible: false,
  ...overrides,
})

/**
 * The default `purchasable_object` has only an `id`, which matches no variant —
 * pass a shaped object (with `course`, or neither `course` nor `run_tag`) when the
 * test needs it to resolve.
 */
const product = (overrides: Partial<Product> = {}): Product => ({
  id: faker.number.int(),
  price: faker.commerce.price({ min: 50, max: 500 }),
  description: faker.commerce.productDescription(),
  is_active: true,
  purchasable_object: { id: faker.number.int() },
  ...overrides,
})

const line = (overrides: Partial<Line> = {}): Line => {
  const unitPrice = faker.commerce.price({ min: 50, max: 500 })
  return {
    id: faker.number.int(),
    quantity: 1,
    item_description: faker.commerce.productName(),
    unit_price: unitPrice,
    total_price: unitPrice,
    product: product(),
    ...overrides,
  }
}

const orderHistory = (overrides: Partial<OrderHistory> = {}): OrderHistory => ({
  id: faker.number.int(),
  state: "fulfilled",
  reference_number: faker.string.alphanumeric(10),
  purchaser: {
    id: faker.number.int(),
    name: faker.person.fullName(),
    created_on: faker.date.past().toISOString(),
    updated_on: faker.date.past().toISOString(),
  },
  total_price_paid: faker.commerce.price({ min: 50, max: 500 }),
  lines: [line()],
  created_on: faker.date.past().toISOString(),
  titles: [],
  updated_on: faker.date.past().toISOString(),
  refund_eligible: false,
  ...overrides,
})

const orderHistoryList = (
  results: OrderHistory[],
  opts: { count?: number; next?: string | null; previous?: string | null } = {},
): PaginatedOrderHistoryList => ({
  count: opts.count ?? results.length,
  next: opts.next ?? null,
  previous: opts.previous ?? null,
  results,
})

export {
  order,
  orderHistory,
  orderHistoryList,
  orderRefund,
  orderStreetAddress,
  orderTransactions,
  line,
  product,
  redeemedDiscount,
  transactionLine,
}
