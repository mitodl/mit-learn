import React from "react"
import { styled } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { productQueries } from "api/mitxonline-hooks/products"
import { canPurchaseRun, priceWithDiscount } from "@/common/mitxonline"

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

/**
 * Returns the price node for a course's Certificate Track card. Resolves the
 * selected run's product price, applies any approved/applied flexible price
 * discount, and renders the discounted price with the original struck through.
 */
export const useCertificatePrice = (
  course: CourseWithCourseRunsSerializerV2,
  selectedRun: CourseRunV2 | undefined,
): React.ReactNode => {
  const product = selectedRun?.products?.[0]
  const financialAidUrl = course?.page?.financial_assistance_form_url
  const hasFinancialAid = !!(financialAidUrl && product)
  const canPurchase = selectedRun ? canPurchaseRun(selectedRun) : false

  const userFlexiblePrice = useQuery({
    ...productQueries.userFlexiblePriceDetail({ productId: product?.id ?? 0 }),
    enabled: canPurchase && hasFinancialAid,
  })

  if (!product?.price) return null

  const price = priceWithDiscount({
    product,
    flexiblePrice: userFlexiblePrice.data,
    avoidCents: true,
  })

  if (price.isDiscounted) {
    return (
      <DiscountedPrice>
        <span>{price.finalPrice}</span>
        <StrickenPrice>{price.originalPrice}</StrickenPrice>
      </DiscountedPrice>
    )
  }

  return price.finalPrice
}
