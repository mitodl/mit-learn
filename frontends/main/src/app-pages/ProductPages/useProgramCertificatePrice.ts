import { useQuery } from "@tanstack/react-query"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { productQueries } from "api/mitxonline-hooks/products"
import { useUserIsAuthenticated } from "api/hooks/user"
import type { PriceRange } from "@/common/mitxonline"
import type { FinancialAid } from "./enrollTypes"
import {
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
   * Formatted price — the program's advertised range when it has one, else the
   * full product price. Null when there is no product price.
   */
  price: string | null
  /**
   * Present when the bundle beats buying the member courses separately
   * (list price > program price). The caller decides whether/how to render
   * it (see ProgramSavingsBlock); program-as-course display never does.
   */
  savings: ProgramSavings | null
  financialAid: FinancialAid | null
}

const toNumericPrice = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

/**
 * Price facts for a program's Certificate Track card: the price to display,
 * savings-vs-separate-purchase data when applicable, and financial aid info.
 *
 * A financial aid discount is never reflected in `price` or `savings` — not even
 * for a user whose flexible price is already approved. It is surfaced as text
 * via `financialAid.applied` ("applied at checkout"), because the discount is
 * applied later, in checkout. This differs from the pre-redesign
 * `ProgramPriceRow`, which reduced the displayed price for an approved
 * flexible price — that behavior is intentionally dropped here.
 */
export const useProgramCertificatePrice = (
  program: V2ProgramDetail,
): ProgramCertificatePriceResult => {
  const isAuthenticated = useUserIsAuthenticated()
  const enrollmentType = getEnrollmentType(program.enrollment_modes)

  const product = program.products[0]
  const financialAidUrl = program.page?.financial_assistance_form_url
  const hasFinancialAid = !!(financialAidUrl && product)

  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled:
      (enrollmentType === "paid" || enrollmentType === "both") &&
      isAuthenticated &&
      hasFinancialAid,
  })

  const financialAid = hasFinancialAid
    ? {
        href: mitxonlineLegacyUrl(financialAidUrl!),
        applied: !!userFlexiblePrice.data?.product_flexible_price?.id,
        // isLoading, not isPending: a disabled query stays pending forever, and
        // this one is disabled for anonymous visitors, who are never approved
        // and so have nothing to wait for.
        pending: userFlexiblePrice.isLoading,
      }
    : null

  // An advertised range displays even with no purchasable product, so the
  // InfoBox agrees with MitxOnlineResourceCard for the same resource. Savings
  // stay behind the product guard: there is nothing to have saved without a
  // price you would actually pay.
  const price = formatResourcePrice(program, product?.price || null)

  if (!product?.price) {
    return { price, savings: null, financialAid }
  }

  const productAmount = toNumericPrice(product.price)
  const current =
    toPriceRange(program) ??
    (productAmount === null ? null : { min: productAmount, max: productAmount })
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

  return { price, savings, financialAid }
}

export type { ProgramSavings, ProgramCertificatePriceResult }
