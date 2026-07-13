import React from "react"
import { styled } from "@mitodl/smoot-design"
import { theme } from "ol-components"
import { pluralize } from "ol-utilities"
import { formatPrice } from "@/common/mitxonline"

/* Ported from ProductSummary.tsx's ProgramPriceRow. Renders the full-width
 * savings block: current program price beside the struck member-course
 * bundle price, plus the "Save $Z" line. */
const ProgramPaySection = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "12px",
  width: "100%",
  color: theme.custom.colors.darkGray2,
}))

/**
 * Horizontal row: [current price block] | [vertical divider] | [list price
 * block]. Wraps so wide price strings stack instead of overflowing the card
 * in narrow cells (half-width tablet cell, small phones).
 */
const ProgramPriceRowInner = styled.div({
  display: "flex",
  flexDirection: "row" as const,
  alignItems: "flex-end" as const,
  flexWrap: "wrap" as const,
  gap: "24px",
  rowGap: "12px",
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

type ProgramSavingsBlockProps = {
  /** Purchasable program price. */
  currentAmount: number
  /** CMS list price: the member courses purchased separately. */
  listAmount: number
  /** Required course count, for the "N courses separately" sentence. */
  totalCourses: number
}

/**
 * Full-width price presentation for a program whose bundle price beats buying
 * the member courses separately: current price beside the struck list price,
 * plus the "Save $X compared to purchasing N courses separately" line.
 */
const ProgramSavingsBlock: React.FC<ProgramSavingsBlockProps> = ({
  currentAmount,
  listAmount,
  totalCourses,
}) => {
  const savingsAmount = listAmount - currentAmount
  return (
    <ProgramPaySection>
      <ProgramPriceRowInner>
        <ProgramCurrentPriceBlock>
          <ProgramPriceAmount>
            {formatPrice(currentAmount, { avoidCents: true })}
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
          compared to purchasing {totalCourses}{" "}
          {pluralize("course", totalCourses)} separately
        </ProgramSavingsDetailText>
      </ProgramDiscountRow>
    </ProgramPaySection>
  )
}

export default ProgramSavingsBlock
export type { ProgramSavingsBlockProps }
