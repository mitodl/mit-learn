import React from "react"
import { useQuery } from "@tanstack/react-query"
import { styled } from "@mitodl/smoot-design"
import { theme } from "ol-components"
import { pluralize } from "ol-utilities"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { productQueries } from "api/mitxonline-hooks/products"
import { useUserIsAuthenticated } from "api/hooks/user"
import {
  formatPrice,
  getEnrollmentType,
  mitxonlineLegacyUrl,
} from "@/common/mitxonline"
import { getTotalRequiredCourses } from "./ProductSummary"

/* Ported from ProductSummary.tsx's ProgramPriceRow. Renders the full-width
 * savings block: current program price beside the struck member-course
 * bundle price, plus the "Save $Z" line. Unlike the original, this never
 * reduces the displayed price for financial aid — see useProgramCertificatePrice. */
const ProgramPaySection = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "12px",
  width: "100%",
  color: theme.custom.colors.darkGray2,
}))

/** Horizontal row: [current price block] | [vertical divider] | [list price block] */
const ProgramPriceRowInner = styled.div({
  display: "flex",
  flexDirection: "row" as const,
  alignItems: "flex-end" as const,
  gap: "24px",
})

const ProgramCurrentPriceBlock = styled.div({
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "flex-end" as const,
  alignItems: "flex-start" as const,
})

const ProgramPriceAmount = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontWeight: theme.typography.fontWeightBold,
  fontSize: "34px",
  lineHeight: "40px",
  color: theme.custom.colors.darkGray2,
}))

const ProgramPriceSuffix = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
}))

const ProgramVerticalDivider = styled.div(() => ({
  width: "1px",
  height: "48px",
  backgroundColor: theme.custom.colors.lightGray2,
  flexShrink: 0,
}))

const ProgramListPriceBlock = styled.div({
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "flex-end" as const,
  alignItems: "flex-start" as const,
})

const ProgramListPriceAmount = styled.span({
  ...theme.typography.body3,
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: "28px",
  lineHeight: "36px",
  display: "flex",
  alignItems: "flex-end" as const,
  textDecoration: "line-through",
  color: theme.custom.colors.silverGrayDark,
})

const ProgramListPriceSubLabel = styled.span({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})

/**
 * "Save $X compared to purchasing N courses separately" as one flowing
 * paragraph — the spans must stay inline so the sentence wraps as text, not
 * as side-by-side boxes.
 */
const ProgramDiscountRow = styled.div({
  width: "100%",
})

const ProgramSavingsText = styled.span({
  ...theme.typography.subtitle3,
  fontWeight: theme.typography.fontWeightBold,
  color: "#008000",
})

const ProgramSavingsDetailText = styled.span({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})

type ProgramCertificatePriceResult = {
  /** Top-right plain price. Null when the savings block applies, or there is no product price. */
  price: React.ReactNode
  /** Full-width savings block. Null unless savings apply. */
  priceBlock: React.ReactNode
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
 * Returns the price presentation and financial aid info for a program's
 * Certificate Track card: either a plain top-right price, or — when the
 * member-course bundle price is cheaper purchased separately — a full-width
 * savings block comparing the two.
 *
 * The displayed price is always the full program price. A financial aid
 * discount is never reflected in `price` or `priceBlock`; it is surfaced as
 * text via `financialAid.applied` ("applied at checkout"), because the
 * discount is applied later, in checkout. This differs from the ported
 * `ProgramPriceRow` in ProductSummary.tsx, which reduces the displayed price
 * for an approved flexible price — that behavior is intentionally dropped
 * here.
 *
 * @param opts.showSavings - Whether the savings block may be shown (default
 *   true). Program-as-course display passes `false`, since program-as-course
 *   never shows savings even when a list price is set.
 */
export const useProgramCertificatePrice = (
  program: V2ProgramDetail,
  opts?: { showSavings?: boolean },
): ProgramCertificatePriceResult => {
  const showSavings = opts?.showSavings ?? true
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
    return { price: null, priceBlock: null, financialAid: null }
  }

  const financialAid = hasFinancialAid
    ? {
        href: mitxonlineLegacyUrl(financialAidUrl!),
        applied: !!userFlexiblePrice.data?.product_flexible_price?.id,
      }
    : null

  const currentAmount = toNumericPrice(product.price)
  const listAmount = toNumericPrice(program.page?.list_price)
  const hasSavings =
    showSavings &&
    currentAmount !== null &&
    listAmount !== null &&
    listAmount > currentAmount

  if (hasSavings && listAmount !== null && currentAmount !== null) {
    const savingsAmount = listAmount - currentAmount
    const totalRequired = getTotalRequiredCourses(program)

    const priceBlock = (
      <ProgramPaySection>
        <ProgramPriceRowInner>
          <ProgramCurrentPriceBlock>
            <ProgramPriceAmount>
              {formatPrice(product.price, { avoidCents: true })}
            </ProgramPriceAmount>
            <ProgramPriceSuffix>full program</ProgramPriceSuffix>
          </ProgramCurrentPriceBlock>
          <ProgramVerticalDivider />
          <ProgramListPriceBlock
            role="group"
            aria-label={`Original price: ${formatPrice(listAmount, { avoidCents: true })} purchased separately`}
          >
            <ProgramListPriceAmount aria-hidden="true">
              {formatPrice(listAmount, { avoidCents: true })}
            </ProgramListPriceAmount>
            <ProgramListPriceSubLabel aria-hidden="true">
              purchased separately
            </ProgramListPriceSubLabel>
          </ProgramListPriceBlock>
        </ProgramPriceRowInner>
        <ProgramDiscountRow>
          <ProgramSavingsText>
            Save {formatPrice(savingsAmount, { avoidCents: true })}
          </ProgramSavingsText>{" "}
          <ProgramSavingsDetailText>
            compared to purchasing {totalRequired}{" "}
            {pluralize("course", totalRequired)} separately
          </ProgramSavingsDetailText>
        </ProgramDiscountRow>
      </ProgramPaySection>
    )

    return { price: null, priceBlock, financialAid }
  }

  return {
    price: formatPrice(product.price, { avoidCents: true }),
    priceBlock: null,
    financialAid,
  }
}
