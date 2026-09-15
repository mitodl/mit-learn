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
 * `kind` distinguishes the two discounts with a rule behind them. A credit can
 * only arise for a program — a `program-child-purchase` discount attaches to a
 * program's product and resolves against that program's requirement tree — so a
 * course quote reaches "aid" or "other" and never "credit".
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
