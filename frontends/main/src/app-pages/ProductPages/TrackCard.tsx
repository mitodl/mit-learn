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

const TopRow = styled.div({
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "8px",
  width: "100%",
})

const LeftCol = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "8px",
  flexGrow: 1,
})

const TrackTitle = styled.h3(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const TrackSubtitle = styled.div(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.darkGray2,
}))

const PriceContainer = styled.div(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
}))

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
  /** Optional full-width price block (e.g., savings). When provided, the top-right price is omitted. */
  priceBlock?: React.ReactNode
  action?: React.ReactNode
  fill?: boolean
}

const TrackCard: React.FC<TrackCardProps> = ({
  variant,
  title,
  subtitle,
  price,
  children,
  note,
  priceBlock,
  action,
  fill,
}) => {
  return (
    <CardShell $fill={fill}>
      <CardBody $variant={variant} $fill={fill}>
        <TopRow>
          <LeftCol>
            <TrackTitle>{title}</TrackTitle>
            <TrackSubtitle>{subtitle}</TrackSubtitle>
          </LeftCol>
          {priceBlock ? null : <PriceContainer>{price}</PriceContainer>}
        </TopRow>

        {priceBlock ? <FullWidthPrice>{priceBlock}</FullWidthPrice> : null}

        {note}

        <FeatureList>{children}</FeatureList>

        {action}
      </CardBody>
    </CardShell>
  )
}

export default TrackCard
