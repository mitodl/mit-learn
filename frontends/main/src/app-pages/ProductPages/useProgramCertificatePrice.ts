import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import type { PriceRange } from "@/common/mitxonline"
import type { AppliedSavings, FinancialAid } from "./enrollTypes"
import { toNumericPrice } from "./appliedSavings"
import { getEnrollmentType, toPriceRange } from "@/common/mitxonline"
import { getTotalRequiredCourses } from "./util"
import { useCertificatePricing } from "./useCertificatePricing"

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
  /** See useCertificatePricing. */
  price: string | null
  /** See useCertificatePricing. */
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
 * Price facts for a program's Certificate Track card: everything
 * useCertificatePricing answers, plus the savings-vs-separate-purchase data a
 * program alone can have.
 */
export const useProgramCertificatePrice = (
  program: V2ProgramDetail,
): ProgramCertificatePriceResult => {
  const enrollmentType = getEnrollmentType(program.enrollment_modes)
  const product = program.products[0]

  const { price, showsRange, financialAid, breakdown } = useCertificatePricing(
    program,
    product,
    { purchasable: enrollmentType === "paid" || enrollmentType === "both" },
  )

  // Savings stay behind the product guard: there is nothing to have saved
  // without a price you would actually pay.
  if (!product?.price) {
    return { price, showsRange, savings: null, financialAid, breakdown }
  }

  const range = toPriceRange(program)
  const productAmount = toNumericPrice(product.price)
  const singlePrice =
    productAmount === null ? null : { min: productAmount, max: productAmount }
  const current = showsRange && range ? range : singlePrice
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
