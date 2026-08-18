import React from "react"
import { styled } from "@mitodl/smoot-design"
import { theme } from "ol-components"
import { pluralize } from "ol-utilities"
import type { PriceRange } from "@/common/mitxonline"
import { formatPrice, formatPriceRange } from "@/common/mitxonline"

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
 * Horizontal row: [current price block] | [list price block], separated by a
 * rule. Wraps so wide price strings stack instead of overflowing the card in
 * narrow cells (half-width tablet cell, small phones) -- and an advertised
 * range never fits beside a list price at the desktop sidebar width, so the
 * wrapped state is the normal one for ranges rather than an edge case.
 *
 * The separator is a gap decoration rather than an element between the two
 * blocks, because it is only meaningful when they share a line. A rule is
 * painted into gaps that exist, so wrapping removes it for free; a sibling
 * element would strand itself at the end of the first line, which is what it
 * used to do. Where gap decorations are unsupported no rule is drawn at all,
 * which is a fine resting state -- the two prices are already distinguished by
 * size, colour, strikethrough, and their captions.
 */
const ProgramPriceRowInner = styled.div({
  display: "flex",
  flexDirection: "row" as const,
  alignItems: "flex-end" as const,
  flexWrap: "wrap" as const,
  // The rule is painted down the middle of the column gap, so the gap carries
  // the space on both sides of it that the divider element used to get from a
  // gap of its own on either side.
  columnGap: "48px",
  rowGap: "12px",
  columnRule: `1px solid ${theme.custom.colors.lightGray2}`,
})

const ProgramCurrentPriceBlock = styled.div({
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "flex-end" as const,
  alignItems: "flex-start" as const,
})

const ProgramPriceAmount = styled.span(({ theme }) => ({
  ...theme.typography.h2,
  color: theme.custom.colors.darkGray2,
}))

const ProgramPriceSuffix = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
}))

const ProgramListPriceBlock = styled.div({
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "flex-end" as const,
  alignItems: "flex-start" as const,
})

const ProgramListPriceAmount = styled.span({
  ...theme.typography.h3,
  // h3 is bold, but the struck list price is deliberately lighter than the
  // current price it is being compared against.
  fontWeight: theme.typography.fontWeightRegular,
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
  /**
   * What the program costs: an advertised range, or `min === max` for a single
   * purchasable price.
   */
  current: PriceRange
  /** CMS list price: the member courses purchased separately. */
  listAmount: number
  /** Required course count, for the "N courses separately" sentence. */
  totalCourses: number
}

/**
 * Full-width price presentation for a program whose bundle price beats buying
 * the member courses separately: current price beside the struck list price,
 * plus the "Save $X compared to purchasing N courses separately" line.
 *
 * When the program advertises a range, the saving is only guaranteed against the
 * top of it, so the amount reads as a floor ("Save $150+").
 */
const ProgramSavingsBlock: React.FC<ProgramSavingsBlockProps> = ({
  current,
  listAmount,
  totalCourses,
}) => {
  const savingsAmount = listAmount - current.max
  // Against a range, only the saving versus its top end is guaranteed.
  const isRange = current.min < current.max
  const savingsLabel = `Save ${formatPrice(savingsAmount, { avoidCents: true })}${
    isRange ? "+" : ""
  }`
  return (
    <ProgramPaySection>
      <ProgramPriceRowInner>
        <ProgramCurrentPriceBlock>
          <ProgramPriceAmount>
            {formatPriceRange(current, { avoidCents: true })}
          </ProgramPriceAmount>
          <ProgramPriceSuffix>full program</ProgramPriceSuffix>
        </ProgramCurrentPriceBlock>
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
        <ProgramSavingsText>{savingsLabel}</ProgramSavingsText>{" "}
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
