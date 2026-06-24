import React from "react"
import { styled } from "@mitodl/smoot-design"
import { useQuery } from "@tanstack/react-query"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { productQueries } from "api/mitxonline-hooks/products"
import {
  canPurchaseRun,
  mitxonlineLegacyUrl,
  priceWithDiscount,
} from "@/common/mitxonline"

const DiscountedPrice = styled.span({
  display: "inline-flex",
  alignItems: "baseline",
  gap: "0.25em",
})

const StrickenPrice = styled.span(({ theme }) => ({
  textDecoration: "line-through",
  opacity: 0.75,
  ...theme.typography.buttonSmall,
}))

type CertificatePriceResult = {
  price: React.ReactNode
  financialAid: { href: string; applied: boolean } | null
}

/**
 * Returns the price node and financial aid info for a course's Certificate
 * Track card. Resolves the selected run's product price, applies any
 * approved/applied flexible price discount, and renders the discounted price
 * with the original struck through.
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

  const priceResult = priceWithDiscount({
    product,
    flexiblePrice: userFlexiblePrice.data,
    avoidCents: true,
  })

  let priceNode: React.ReactNode
  if (priceResult.isDiscounted) {
    // The strike-through is visual only, so assistive tech would otherwise read
    // two bare prices with no current-vs-original cue. Announce a single
    // sensible phrase and hide the visual amounts.
    priceNode = (
      <DiscountedPrice
        role="group"
        aria-label={`Discounted price: ${priceResult.finalPrice}, was ${priceResult.originalPrice}`}
      >
        <span aria-hidden="true">{priceResult.finalPrice}</span>
        <StrickenPrice aria-hidden="true">
          {priceResult.originalPrice}
        </StrickenPrice>
      </DiscountedPrice>
    )
  } else {
    priceNode = priceResult.finalPrice
  }

  const financialAid = hasFinancialAid
    ? {
        href: mitxonlineLegacyUrl(financialAidUrl),
        applied: !!userFlexiblePrice.data?.product_flexible_price?.id,
      }
    : null

  return { price: priceNode, financialAid }
}
