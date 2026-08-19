import React from "react"
import { styled } from "@mitodl/smoot-design"
import { RiCheckLine } from "@remixicon/react"

/**
 * Shared scaffold for the two enrollment "track" cards (Certificate Track and
 * Learn for Free), which differ only in surface treatment and content. Keeping
 * the structure here means both cards share the exact DOM the grid layout
 * stretches, so they can't drift apart.
 *
 * `fill` makes the card grow to fill a stretched grid cell and drops its action
 * to the bottom — used in the side-by-side "both" layout so the two cards match
 * height and their buttons align. It is a no-op wherever the cell is only
 * content-height (single-column grid), so the card owns this behavior instead of
 * a parent reaching into its DOM.
 */

type CardVariant = "shaded" | "bordered"

const CardShell = styled.div<{ $fill?: boolean }>(({ $fill }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
  alignSelf: "stretch",
  ...($fill ? { flexGrow: 1 } : {}),
}))

const CardBody = styled.div<{ $variant: CardVariant; $fill?: boolean }>(
  ({ theme, $variant, $fill }) => ({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "16px",
    gap: "16px",
    borderRadius: theme.shape.borderRadius,
    alignSelf: "stretch",
    boxSizing: "border-box",
    ...($variant === "shaded"
      ? { background: theme.custom.colors.lightGray1 }
      : {
          background: theme.custom.colors.white,
          border: `1px solid ${theme.custom.colors.lightGray2}`,
        }),
    ...($fill
      ? {
          flexGrow: 1,
          justifyContent: "flex-start",
          "& > :last-child": { marginTop: "auto" },
        }
      : {}),
  }),
)

const CardHeader = styled.div<{ $hasAside?: boolean }>(({ $hasAside }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  // The aside belongs to the title, not the subtitle, so it sits tight under
  // the title row (see TitleGroup) and the subtitle gets a wider break below it
  // than the 8px that separates the header's rows when there is no aside.
  gap: $hasAside ? "16px" : "8px",
  width: "100%",
}))

/**
 * The title row plus its optional aside, grouped so the aside reads as a
 * continuation of the title rather than as another header row.
 */
const TitleGroup = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
  width: "100%",
})

/**
 * Title and price only — the subtitle sits below at full card width. Keeping it
 * out of this row means the price has to clear just the title, and the subtitle
 * gets the whole card to stay on one line.
 */
const TitleRow = styled.div({
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px",
  // A wrapped price reads as its own row, so give it more room than the 8px
  // separating the header's rows.
  rowGap: "12px",
  width: "100%",
})

const TrackTitle = styled.h3(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  /**
   * Grows to push the price right, but never narrows below its own text: a flex
   * item's wrap decision uses its max-content width, so a price that cannot fit
   * beside the untruncated title wraps to its own line (see TitleRow's
   * flexWrap) rather than breaking the title across two.
   */
  flexGrow: 1,
}))

const TrackSubtitle = styled.div(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.darkGray2,
}))

const PriceContainer = styled.div<{ $compact?: boolean }>(
  ({ theme, $compact }) => ({
    ...($compact ? theme.typography.h5 : theme.typography.h4),
    // Match TrackTitle's line height so the price does not set the row's.
    lineHeight: theme.typography.subtitle1.lineHeight,
    color: theme.custom.colors.darkGray2,
    whiteSpace: "nowrap",
    // Stay right-aligned whether it sits beside the title or wraps below it.
    marginLeft: "auto",
  }),
)

const FullWidthPrice = styled.div({
  width: "100%",
})

const FeatureList = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "12px",
  width: "100%",
})

export const FeatureRow = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "4px",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
}))

export const FeatureIcon = styled(RiCheckLine)(({ theme }) => ({
  width: "16px",
  height: "16px",
  color: theme.custom.colors.green,
  flexShrink: 0,
}))

/**
 * The "Access to this course/program & materials" bullet shared by both track
 * cards — identical wording in each, so it lives here to stay in sync.
 */
export const AccessFeatureRow: React.FC<{
  productNoun: "course" | "program"
}> = ({ productNoun }) => (
  <FeatureRow>
    <FeatureIcon aria-hidden="true" />
    <span>
      {productNoun === "program"
        ? "Access to this program & materials"
        : "Access to this course & course materials"}
    </span>
  </FeatureRow>
)

type TrackCardProps = {
  variant: CardVariant
  title: string
  subtitle: React.ReactNode
  price: React.ReactNode
  /** Feature bullets (FeatureRow elements). */
  children: React.ReactNode
  /** Optional note between the header and the feature list. */
  note?: React.ReactNode
  /**
   * Render the price one step down the heading scale. For prices too wide to
   * sit beside the title otherwise — an advertised range is about half again as
   * wide as a single price. Sizes the price element itself rather than nesting a
   * smaller one inside it, which would leave the text on a line box struck for
   * the larger size.
   */
  compactPrice?: boolean
  /** Optional full-width price block (e.g., savings). When provided, the top-right price is omitted. */
  priceBlock?: React.ReactNode
  /** Optional row directly beneath the title row, e.g. the financial aid link. */
  headerAside?: React.ReactNode
  action?: React.ReactNode
  fill?: boolean
}

const TrackCard: React.FC<TrackCardProps> = ({
  variant,
  title,
  subtitle,
  price,
  compactPrice,
  children,
  note,
  priceBlock,
  headerAside,
  action,
  fill,
}) => {
  return (
    <CardShell $fill={fill}>
      <CardBody $variant={variant} $fill={fill}>
        <CardHeader $hasAside={!!headerAside}>
          <TitleGroup>
            <TitleRow>
              <TrackTitle>{title}</TrackTitle>
              {priceBlock ? null : (
                <PriceContainer $compact={compactPrice}>{price}</PriceContainer>
              )}
            </TitleRow>
            {headerAside}
          </TitleGroup>
          <TrackSubtitle>{subtitle}</TrackSubtitle>
        </CardHeader>

        {priceBlock ? <FullWidthPrice>{priceBlock}</FullWidthPrice> : null}

        {note}

        <FeatureList>{children}</FeatureList>

        {action}
      </CardBody>
    </CardShell>
  )
}

export default TrackCard
