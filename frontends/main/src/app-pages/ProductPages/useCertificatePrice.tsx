import React from "react"
import { useQuery } from "@tanstack/react-query"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { productQueries } from "api/mitxonline-hooks/products"
import {
  canPurchaseRun,
  mitxonlineLegacyUrl,
  formatPrice,
} from "@/common/mitxonline"

type CertificatePriceResult = {
  price: React.ReactNode
  financialAid: { href: string; applied: boolean } | null
}

/**
 * Returns the price node and financial aid info for a course's Certificate
 * Track card. The displayed price is always the full certificate price — a
 * financial aid discount is not reflected here; it is surfaced as a text note
 * ("applied at checkout") because the discount is applied later, in checkout.
 * `applied` reports whether the user already has an approved flexible price.
 */
export const useCertificatePrice = (
  course: CourseWithCourseRunsSerializerV2,
  selectedRun: CourseRunV2 | undefined,
): CertificatePriceResult => {
  const product = selectedRun?.products?.[0]
  const financialAidUrl = course?.page?.financial_assistance_form_url
  const hasFinancialAid = !!(financialAidUrl && product)
  const canPurchase = selectedRun ? canPurchaseRun(selectedRun) : false

  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled: canPurchase && hasFinancialAid,
  })

  if (!product?.price) return { price: null, financialAid: null }

  const financialAid = hasFinancialAid
    ? {
        href: mitxonlineLegacyUrl(financialAidUrl),
        applied: !!userFlexiblePrice.data?.product_flexible_price?.id,
      }
    : null

  return {
    price: formatPrice(product.price, { avoidCents: true }),
    financialAid,
  }
}
