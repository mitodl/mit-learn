import { useQuery } from "@tanstack/react-query"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { productQueries } from "api/mitxonline-hooks/products"
import { useUserIsAuthenticated } from "api/hooks/user"
import type { PriceRange } from "@/common/mitxonline"
import type { AppliedSavings, FinancialAid } from "./enrollTypes"
import { toAppliedSavings, toNumericPrice } from "./appliedSavings"
import {
  formatPrice,
  formatResourcePrice,
  getEnrollmentType,
  mitxonlineLegacyUrl,
  toPriceRange,
} from "@/common/mitxonline"
import { getTotalRequiredCourses } from "./util"

type ProgramSavings = {
  /**
   * What the program costs: its advertised range, or `min === max` for a single
   * purchasable price.
   */
  current: PriceRange
  /** CMS list price: the member courses purchased separately. */
  listAmount: number
  /** Required course count, for the "N courses separately" sentence. */
  totalCourses: number
}

type ProgramCertificatePriceResult = {
  /**
   * Formatted price — the program's advertised range when it has one and this
   * learner can still reach its floor, else the full product price. Null when
   * there is no product price.
   */
  price: string | null
  /**
   * Whether `price` is an advertised range. Callers size the price slot from
   * this; deriving it from the program alone would keep a range's width for a
   * learner whose price has collapsed to a single number.
   */
  showsRange: boolean
  /**
   * Present when the bundle beats buying the member courses separately
   * (list price > program price). The caller decides whether/how to render
   * it (see ProgramSavingsBlock); program-as-course display never does.
   */
  savings: ProgramSavings | null
  financialAid: FinancialAid | null
  /** Present only when the quote takes something off; see AppliedSavings. */
  breakdown: AppliedSavings | null
}

/**
 * Price facts for a program's Certificate Track card: the price to display, the
 * discount checkout would apply, savings-vs-separate-purchase data when
 * applicable, and financial aid info.
 *
 * The advertised range exists to advertise the financial-assistance floor, so a
 * learner who has already been quoted against it — anyone with an approved
 * flexible price — is shown a single price instead.
 */
export const useProgramCertificatePrice = (
  program: V2ProgramDetail,
): ProgramCertificatePriceResult => {
  const isAuthenticated = useUserIsAuthenticated()
  const enrollmentType = getEnrollmentType(program.enrollment_modes)

  const product = program.products[0]
  const financialAidUrl = program.page?.financial_assistance_form_url
  const hasFinancialAid = !!(financialAidUrl && product)

  const userPricing = useQuery({
    ...productQueries.userPricingDetail({ productId: product?.id ?? 0 }),
    // Any purchasable program can carry a discount, whether or not it offers
    // financial assistance. Guard on the product itself: `hasFinancialAid`
    // conflates the CMS form URL with the product's existence, and without a
    // product the query would ask for product 0.
    enabled:
      (enrollmentType === "paid" || enrollmentType === "both") &&
      isAuthenticated &&
      !!product?.price,
    // The browser query client throws 400/401/403 into the route's error
    // boundary, which would replace the whole program page over a stale
    // mitxonline session. A quote we cannot get just leaves the card as it is.
    throwOnError: false,
  })

  const quote = userPricing.data
  // Whether aid is approved, and so a tier has already been quoted. Not the
  // same question as whether aid is the discount that won: a learner can be
  // approved and still lose the slot to a cheaper discount.
  const approvedForAid = !!quote?.product_flexible_price

  const financialAid = hasFinancialAid
    ? {
        href: mitxonlineLegacyUrl(financialAidUrl!),
        applied: approvedForAid,
        // isLoading, not isPending: a disabled query stays pending forever, and
        // this one is disabled for anonymous visitors, who are never approved
        // and so have nothing to wait for.
        pending: userPricing.isLoading,
      }
    : null

  const breakdown: AppliedSavings | null = toAppliedSavings(quote)

  const range = toPriceRange(program)
  const showsRange = range !== null && !approvedForAid

  // An advertised range displays even with no purchasable product, so the
  // InfoBox agrees with MitxOnlineResourceCard for the same resource. Savings
  // stay behind the product guard: there is nothing to have saved without a
  // price you would actually pay.
  const price =
    !showsRange && product?.price
      ? formatPrice(product.price)
      : formatResourcePrice(program, product?.price || null)

  if (!product?.price) {
    return { price, showsRange, savings: null, financialAid, breakdown }
  }

  const productAmount = toNumericPrice(product.price)
  const singlePrice =
    productAmount === null ? null : { min: productAmount, max: productAmount }
  const current = showsRange ? range : singlePrice
  const listAmount = toNumericPrice(program.page?.list_price)
  // A list price that falls inside an advertised range does not beat every price
  // in it, so the savings framing only holds above the top of the range.
  const savings =
    current !== null && listAmount !== null && listAmount > current.max
      ? {
          current,
          listAmount,
          totalCourses: getTotalRequiredCourses(program),
        }
      : null

  return { price, showsRange, savings, financialAid, breakdown }
}

export type { ProgramSavings, ProgramCertificatePriceResult }
