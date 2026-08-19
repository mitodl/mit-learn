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
import type { FinancialAid } from "./enrollTypes"

type CourseCertificatePriceResult = {
  price: string | null
  financialAid: FinancialAid | null
}

/**
 * Returns the price and financial aid info for a course's Certificate Track
 * card. The displayed price is the course's advertised range when it has one,
 * otherwise the run product's full price. A financial aid discount is never
 * reflected in it — not even for a user whose flexible price is already
 * approved — because the discount is applied later, in checkout; it is surfaced
 * as a text note instead. `applied` reports whether the user has an approved
 * flexible price.
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

  // The flexible-price lookup is user-scoped; never fire it for anonymous
  // visitors.
  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled: isAuthenticated && canPurchase && hasFinancialAid,
  })

  const financialAid = hasFinancialAid
    ? {
        href: mitxonlineLegacyUrl(financialAidUrl),
        applied: !!userFlexiblePrice.data?.product_flexible_price?.id,
        // isLoading, not isPending: a disabled query stays pending forever, and
        // this one is disabled for anonymous visitors, who are never approved
        // and so have nothing to wait for.
        pending: userFlexiblePrice.isLoading,
      }
    : null

  // An advertised range displays even with no purchasable product, so the
  // InfoBox agrees with MitxOnlineResourceCard for the same resource; without
  // either a range or a product price there is nothing to show.
  return {
    price: formatResourcePrice(course, product?.price || null),
    financialAid,
  }
}
