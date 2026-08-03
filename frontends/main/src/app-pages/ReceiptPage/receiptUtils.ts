import moment from "moment"
import type { Order, OrderStreetAddress } from "@mitodl/mitxonline-api-axios/v2"
import { formatPrice } from "@/common/mitxonline"

/** Receipt amounts always show cents, unlike catalog prices. */
const formatMoney = (amount: number | string): string =>
  formatPrice(amount, { avoidCents: false })

/**
 * Long-form receipt dates, e.g. "June 14, 2024". UTC, not the viewer's zone:
 * course dates are stored at UTC midnight and would otherwise render a day early
 * west of Greenwich.
 */
const formatReceiptDate = (date: string): string =>
  moment.utc(date).format("MMMM DD, YYYY")

/** A line's dates as one range; either end may be absent. */
const formatDateRange = (
  startDate?: string | null,
  endDate?: string | null,
): string | null => {
  const start = startDate ? formatReceiptDate(startDate) : null
  const end = endDate ? formatReceiptDate(endDate) : null
  if (start && end) return `${start} - ${end}`
  return start ?? end
}

/**
 * Billing address as one line, e.g. "123 Main Street, Danvers MA, 01923". Every
 * part is optional, so only present ones are joined.
 */
const formatStreetAddress = (
  address: OrderStreetAddress | undefined,
): string | null => {
  if (!address) return null
  const cityAndState = [address.city, address.state]
    .filter(Boolean)
    .join(" ")
    .trim()
  const parts = [
    ...(address.line ?? []),
    cityAndState,
    address.postal_code,
    address.country,
  ].filter((part): part is string => Boolean(part && part.trim()))

  return parts.length > 0 ? parts.join(", ") : null
}

/** e.g. "Visa | xxxxxxxxxxxx1111", or null when there was no payment. */
const formatPaymentMethod = (order: Order): string | null => {
  const transaction = order.transactions
  if (!transaction) return null
  if (transaction.payment_method === "paypal") return "Paypal"
  const parts = [transaction.card_type, transaction.card_number].filter(Boolean)
  return parts.length > 0 ? parts.join(" | ") : null
}

/** The discount code redeemed on the order, if any. */
const getDiscountCode = (order: Order): string | null =>
  order.discounts[0]?.redeemed_discount?.discount_code ?? null

export {
  formatDateRange,
  formatMoney,
  formatPaymentMethod,
  formatReceiptDate,
  formatStreetAddress,
  getDiscountCode,
}
