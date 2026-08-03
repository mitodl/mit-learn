import moment from "moment"
import type { Order, OrderStreetAddress } from "@mitodl/mitxonline-api-axios/v2"
import { formatPrice } from "@/common/mitxonline"

/**
 * Receipt amounts always show cents, unlike catalog prices — `$1,524.00` rather
 * than `$1,524`. A receipt is a financial record, so a rounded-looking figure is
 * misleading even when the cents are zero.
 */
const formatMoney = (amount: number | string): string =>
  formatPrice(amount, { avoidCents: false })

/**
 * Long-form receipt dates, e.g. "June 14, 2024".
 *
 * Formatted in UTC, not the viewer's zone, unlike `ol-utilities`' `formatDate`.
 * MITx Online stores course start/end dates and order timestamps at UTC
 * midnight, which renders as the *previous* day for anyone west of Greenwich —
 * so a receipt viewed in Boston would disagree with the order it records. It
 * also keeps the output stable regardless of where the receipt is opened, which
 * matters for a financial document.
 */
const formatReceiptDate = (date: string): string =>
  moment.utc(date).format("MMMM DD, YYYY")

/**
 * The run/program dates for a line, as a single range. Either end may be absent
 * (self-paced runs often have no end date), in which case only the known end of
 * the range is shown.
 */
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
 * Flatten MITx Online's billing address into one line, e.g.
 * "123 Main Street, Danvers MA, 01923".
 *
 * Every part is optional — the address comes from the CyberSource transaction
 * payload, which only includes the fields the payment form collected — so parts
 * are joined only when present rather than leaving stray commas behind.
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

/**
 * The payment method as shown on the receipt: "Visa | xxxxxxxxxxxx1111" for
 * card payments, "Paypal" for PayPal, and nothing when MITx Online recorded no
 * transaction (e.g. a fully discounted order, which has no payment to describe).
 */
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
