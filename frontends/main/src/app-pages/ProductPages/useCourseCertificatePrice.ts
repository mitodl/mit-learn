import { useQuery } from "@tanstack/react-query"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { productQueries } from "api/mitxonline-hooks/products"
import { useUserIsAuthenticated } from "api/hooks/user"
import {
  canPurchaseRun,
  mitxonlineLegacyUrl,
  formatResourcePrice,
} from "@/common/mitxonline"
import type { AppliedSavings, FinancialAid } from "./enrollTypes"
import { toAppliedSavings } from "./appliedSavings"

type CourseCertificatePriceResult = {
  price: string | null
  financialAid: FinancialAid | null
  /** Present only when the quote takes something off; see AppliedSavings. */
  breakdown: AppliedSavings | null
}

/**
 * Price facts for a course's Certificate Track card: the price to display, the
 * discount checkout would apply, and financial aid info.
 *
 * `price` is the advertised range when the course has one, else the run
 * product's full price — never the learner's quoted price. A learner whose
 * quote takes something off is shown `breakdown` in place of that card
 * entirely, so the two never appear together.
 */
export const useCourseCertificatePrice = (
  course: CourseWithCourseRunsSerializerV2,
  selectedRun: CourseRunV2 | undefined,
): CourseCertificatePriceResult => {
  const isAuthenticated = useUserIsAuthenticated()
  const product = selectedRun?.products?.[0]
  const financialAidUrl = course?.page?.financial_assistance_form_url
  const hasFinancialAid = !!(financialAidUrl && product)
  const canPurchase = selectedRun ? canPurchaseRun(selectedRun) : false

  // The pricing lookup is user-scoped and the endpoint rejects anonymous
  // requests; never fire it for a visitor who is not signed in.
  //
  // Any purchasable course can carry a discount, whether or not it offers
  // financial assistance, so the guard is the product rather than the CMS aid
  // form: a learner can hold an automatic or user-tied discount either way.
  const userPricing = useQuery({
    ...productQueries.userPricingDetail({ productId: product?.id ?? 0 }),
    enabled: isAuthenticated && canPurchase && !!product?.price,
    // The browser query client throws 400/401/403 into the route's error
    // boundary, which would replace the whole course page over a stale
    // mitxonline session. A quote we cannot get just leaves the card as it is.
    throwOnError: false,
  })

  const financialAid = hasFinancialAid
    ? {
        href: mitxonlineLegacyUrl(financialAidUrl),
        applied: !!userPricing.data?.product_flexible_price?.id,
        // isLoading, not isPending: a disabled query stays pending forever, and
        // this one is disabled for anonymous visitors, who are never approved
        // and so have nothing to wait for.
        pending: userPricing.isLoading,
      }
    : null

  // An advertised range displays even with no purchasable product, so the
  // InfoBox agrees with MitxOnlineResourceCard for the same resource; without
  // either a range or a product price there is nothing to show.
  return {
    price: formatResourcePrice(course, product?.price || null),
    financialAid,
    breakdown: toAppliedSavings(userPricing.data),
  }
}
