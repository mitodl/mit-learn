import React from "react"
import { styled, Typography } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { RiBookOpenLine } from "@remixicon/react"

/**
 * The card the empty state is drawn in, which is outlined rather than shadowed
 * -- there is nothing under it to lift it off, so the design marks it out with
 * a hairline instead.
 */
const Card = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  padding: "56px 32px",
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
}))

/** The 56px disc the glyph sits in, in the page's own grey. */
const IconCircle = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "56px",
  height: "56px",
  borderRadius: "500px",
  backgroundColor: theme.custom.colors.lightGray1,
  svg: {
    width: "24px",
    height: "24px",
    color: theme.custom.colors.silverGrayDark,
  },
}))

const Heading = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
  textAlign: "center",
}))

const Explanation = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  textAlign: "center",
}))

/**
 * The design draws this at `darkGray2`, where the shared bordered button
 * carries `silverGrayDark` until it is hovered.
 */
const ClearButton = styled(Button)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
}))

type NoResultsProps = {
  /**
   * What the search found none of, named as the active tab names it -- "no
   * learning materials match these filters" rather than "no results", which
   * says nothing the heading above the grid does not.
   */
  noun: string
  /**
   * Whether there is anything for the button to clear, which is the same
   * question the chip row asks: with nothing filtering there is nothing to
   * take away, and a button that cannot change the answer is worse than none.
   */
  canClearFilters: boolean
  onClearFilters: () => void
}

/**
 * What the results grid is replaced by when a search comes back empty.
 *
 * Only for the cards layout: the other layouts keep the plain line of text
 * they have always shown, which sits above a facet sidebar that already offers
 * a way out.
 */
const NoResults: React.FC<NoResultsProps> = ({
  noun,
  canClearFilters,
  onClearFilters,
}) => (
  <Card data-testid="no-results">
    <IconCircle>
      <RiBookOpenLine aria-hidden />
    </IconCircle>
    {/* Both variants already map to `p` in the theme, so neither needs
        `component` -- which `styled()` would not type through anyway. */}
    <Heading variant="subtitle1">No {noun} match these filters</Heading>
    <Explanation variant="body2">
      Try removing a filter or searching for a different topic.
    </Explanation>
    {canClearFilters ? (
      <ClearButton variant="bordered" size="medium" onClick={onClearFilters}>
        Clear all filters
      </ClearButton>
    ) : null}
  </Card>
)

export default NoResults
