import {
  DiscountTypeEnum,
  PaymentTypeEnum,
} from "@mitodl/mitxonline-api-axios/v2"
import type { UserPricingProduct } from "@mitodl/mitxonline-api-axios/v2"
import { formatPrice } from "@/common/mitxonline"
import type { AppliedSavings } from "./enrollTypes"

const toNumericPrice = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

/**
 * The rows a quote subtracts into, or null when it takes nothing off. Shared by
 * the course and program price hooks: the quote answers the same question for
 * either product, and the wording that differs between them belongs to the
 * views, not here.
 *
 * `kind` distinguishes the two discounts with a rule behind them. "credit" keys
 * on the discount type rather than the redemption type, which holds because
 * mitxonline's `paid_amount_off_discount_shape` CheckConstraint makes
 * paid-amount-off imply the program-child-purchase redemption type — the
 * constraint, not the product-link rule, is what rules out any other pairing.
 * A course quote therefore reaches "aid" or "other" and never "credit": a
 * paid-amount-off discount is only ever funded by resolving a program's
 * requirement tree, and `_program_for_product` returns None for a product that
 * does not sell a program, so no source resolves and no amount arrives.
 */
export const toAppliedSavings = (
  quote: UserPricingProduct | undefined,
): AppliedSavings | null => {
  const discount = quote?.discount
  const amountOff = discount ? toNumericPrice(discount.amount_off) : null
  // A discount worth nothing cannot reach us — the backend keeps a candidate
  // only while it beats the running price — so this guard is defensive.
  if (!quote || !discount || amountOff === null || amountOff <= 0) return null
  return {
    fullPrice: formatPrice(quote.price),
    amountOff: formatPrice(amountOff),
    todaysPrice: formatPrice(quote.user_price),
    sourceTitle: discount.source?.title ?? null,
    kind:
      discount.discount_type === DiscountTypeEnum.PaidAmountOff
        ? "credit"
        : discount.payment_type === PaymentTypeEnum.FinancialAssistance
          ? "aid"
          : "other",
  }
}

export { toNumericPrice }
