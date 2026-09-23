import { useQuery } from "@tanstack/react-query"
import type { BaseProduct } from "@mitodl/mitxonline-api-axios/v2"
import { productQueries } from "api/mitxonline-hooks/products"
import { useUserIsAuthenticated } from "api/hooks/user"
import {
  formatPrice,
  formatResourcePrice,
  mitxonlineLegacyUrl,
  toPriceRange,
} from "@/common/mitxonline"
import type { AppliedSavings, FinancialAid } from "./enrollTypes"
import { toAppliedSavings } from "./appliedSavings"

/** The parts of a course or program that price its certificate track. */
type PricedResource = {
  page?: { financial_assistance_form_url?: string | null } | null
  min_price?: number | null
  max_price?: number | null
}

type CertificatePricing = {
  /**
   * Formatted price — the advertised range when the resource has one and this
   * learner can still reach its floor, else the full product price. Null when
   * there is neither.
   */
  price: string | null
  /**
   * Whether `price` is an advertised range. Callers size the price slot from
   * this; deriving it from the resource alone would keep a range's width for a
   * learner whose price has collapsed to a single number.
   */
  showsRange: boolean
  /** Whether this learner has an approved flexible price, at any tier. */
  approvedForAid: boolean
  /**
   * The aid indicator to render, or null when there is nothing true to say —
   * no aid on offer, or an approval that discounted nothing. See the hook.
   */
  financialAid: FinancialAid | null
  /** Present only when the quote takes something off; see AppliedSavings. */
  breakdown: AppliedSavings | null
}

/**
 * Price facts shared by the course and program Certificate Track cards: the
 * price to display, the discount checkout would apply, and financial aid info.
 * The two differ only in how they find the product and in whether they are
 * purchasable, so the caller supplies both and everything downstream of the
 * quote is decided once, here.
 *
 * The advertised range exists to advertise the financial-assistance floor, so a
 * learner who has already been quoted against it — anyone with an approved
 * flexible price — is shown a single price instead.
 */
export const useCertificatePricing = (
  resource: PricedResource,
  product: BaseProduct | undefined,
  { purchasable }: { purchasable: boolean },
): CertificatePricing => {
  const isAuthenticated = useUserIsAuthenticated()
  const financialAidUrl = resource.page?.financial_assistance_form_url
  const hasFinancialAid = !!(financialAidUrl && product)

  // The pricing lookup is user-scoped and the endpoint rejects anonymous
  // requests; never fire it for a visitor who is not signed in.
  //
  // Any purchasable product can carry a discount, whether or not it offers
  // financial assistance, so the guard is the product rather than the CMS aid
  // form: a learner can hold an automatic or user-tied discount either way.
  // Without a product the query would ask for product 0.
  const userPricing = useQuery({
    ...productQueries.userPricingDetail({ productId: product?.id ?? 0 }),
    enabled: isAuthenticated && purchasable && !!product?.price,
    // The browser query client throws 400/401/403 into the route's error
    // boundary, which would replace the whole page over a stale mitxonline
    // session. A quote we cannot get just leaves the card as it is.
    throwOnError: false,
  })

  const quote = userPricing.data
  // Whether aid is approved, and so a tier has already been quoted. Not the
  // same question as whether aid is the discount that won: a learner can be
  // approved and still lose the slot to a cheaper discount.
  const approvedForAid = !!quote?.product_flexible_price
  const breakdown = toAppliedSavings(quote)

  // mitxonline's APPROVED means it accepted the learner's declared income, not
  // that the income earned them anything: the top tier discounts by 0%, and the
  // aid form tells that learner "You did not qualify for financial assistance."
  // Approved with nothing off is therefore the one state this row cannot word.
  // "Approved" beside an undiscounted price claims a success they did not get,
  // and "Apply" is wrong because they already did. So it says nothing, and the
  // rejection stays on the aid form where they read it, rather than being
  // repeated beside a buy button. Approved-but-outbid keeps the indicator: that
  // learner has a real tier and a real discount, just not this one.
  const aidHasNothingToSay = approvedForAid && !breakdown

  const financialAid =
    hasFinancialAid && !aidHasNothingToSay
      ? {
          href: mitxonlineLegacyUrl(financialAidUrl),
          applied: approvedForAid,
          // isLoading, not isPending: a disabled query stays pending forever, and
          // this one is disabled for anonymous visitors, who are never approved
          // and so have nothing to wait for.
          pending: userPricing.isLoading,
        }
      : null

  const showsRange = toPriceRange(resource) !== null && !approvedForAid

  // An advertised range displays even with no purchasable product, so the
  // InfoBox agrees with MitxOnlineResourceCard for the same resource.
  // formatResourcePrice prefers the range; a learner already quoted against it
  // gets the single product price instead.
  const price =
    !showsRange && product?.price
      ? formatPrice(product.price)
      : formatResourcePrice(resource, product?.price || null)

  return {
    price,
    showsRange,
    approvedForAid,
    financialAid,
    breakdown,
  }
}

export type { CertificatePricing }
