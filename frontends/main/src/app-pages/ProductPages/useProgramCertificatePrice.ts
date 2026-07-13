import { useQuery } from "@tanstack/react-query"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { productQueries } from "api/mitxonline-hooks/products"
import { useUserIsAuthenticated } from "api/hooks/user"
import {
  formatPrice,
  getEnrollmentType,
  mitxonlineLegacyUrl,
} from "@/common/mitxonline"
import { getTotalRequiredCourses } from "./util"

type ProgramSavings = {
  /** Purchasable program price. */
  currentAmount: number
  /** CMS list price: the member courses purchased separately. */
  listAmount: number
  /** Required course count, for the "N courses separately" sentence. */
  totalCourses: number
}

type ProgramCertificatePriceResult = {
  /** Formatted full program price; null when there is no product price. */
  price: string | null
  /**
   * Present when the bundle beats buying the member courses separately
   * (list price > program price). The caller decides whether/how to render
   * it (see ProgramSavingsBlock); program-as-course display never does.
   */
  savings: ProgramSavings | null
  financialAid: { href: string; applied: boolean } | null
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
 * Price facts for a program's Certificate Track card: the full program price,
 * savings-vs-separate-purchase data when applicable, and financial aid info.
 *
 * The price is always the full program price. A financial aid discount is
 * never reflected in `price` or `savings`; it is surfaced as text via
 * `financialAid.applied` ("applied at checkout"), because the discount is
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

  if (!product?.price) {
    return { price: null, savings: null, financialAid: null }
  }

  const financialAid = hasFinancialAid
    ? {
        href: mitxonlineLegacyUrl(financialAidUrl!),
        applied: !!userFlexiblePrice.data?.product_flexible_price?.id,
      }
    : null

  const currentAmount = toNumericPrice(product.price)
  const listAmount = toNumericPrice(program.page?.list_price)
  const savings =
    currentAmount !== null && listAmount !== null && listAmount > currentAmount
      ? {
          currentAmount,
          listAmount,
          totalCourses: getTotalRequiredCourses(program),
        }
      : null

  return {
    price: formatPrice(product.price, { avoidCents: true }),
    savings,
    financialAid,
  }
}

export type { ProgramSavings, ProgramCertificatePriceResult }
