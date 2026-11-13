import React, { useId } from "react"
import { default as NextImage } from "next/image"
import classnames from "classnames"
import { RiAwardLine } from "@remixicon/react"
import { LinkAdapter, Skeleton, styled } from "ol-components"
import type { PushUrl } from "ol-components"
import {
  DEFAULT_RESOURCE_IMG,
  LocalDate,
  useImageWithFallback,
} from "ol-utilities"

type ResourceCardSize = "small" | "medium"

/** `size` fixes the card's width; without it the card fills its container. */
type CardLayoutProps =
  | { layout: "vertical"; size?: ResourceCardSize }
  | { layout: "responsive"; size?: never }

type MetadataItem = {
  label: string
  value: React.ReactNode
}

type PricePanel = {
  tone: "dark" | "light" | "neutral"
  primary?: string
  certificate?: string
  /**
   * Follows `certificate` as "Type: price", and moves to the next line whole
   * rather than breaking.
   */
  certificatePrice?: string
  license?: string
}

/** "Starts: Anytime", the start date, or nothing. */
const startsMetadata = (
  anytime: boolean,
  date: string | null | undefined,
): MetadataItem[] => {
  if (anytime) return [{ label: "Starts", value: "Anytime" }]
  if (!date) return []
  return [
    { label: "Starts", value: <LocalDate date={date} format="MMM D, YYYY" /> },
  ]
}

/** The light panel reading "Free", for every resource that is free to take. */
const freePanel = (
  details: Pick<PricePanel, "certificate" | "certificatePrice" | "license">,
): PricePanel => ({ tone: "light", primary: "Free", ...details })

type CardAction = {
  label: string
  /** The resource is already in the list this action adds it to. */
  filled: boolean
  icon: React.ReactNode
  onClick: React.MouseEventHandler<HTMLButtonElement>
}

type ResourceCardContent = {
  title: string
  typeLabel: string
  parentCourseName?: string
  imageSrc: string | null
  /** Replaces the default image when there is no `imageSrc`. */
  placeholderIcon?: React.ReactNode
  /**
   * Replaces the default image, ahead of `placeholderIcon`, when there is no
   * `imageSrc`: a short label over a value, e.g. a problem's set and topic.
   */
  placeholderDetails?: { label?: string; value: string }
  metadata: MetadataItem[]
  price: PricePanel
  lang?: string
}

type ResourceCardViewProps = ResourceCardContent &
  CardLayoutProps & {
    href: string
    pushUrl?: PushUrl
    onLinkClick?: React.MouseEventHandler<HTMLAnchorElement>
    /** In order, at the foot of the content, the last one beside the last metadata line. */
    actions?: CardAction[]
    headingLevel: HeadingLevel
    className?: string
  }

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

const WIDTHS: Record<ResourceCardSize, number> = { small: 190, medium: 300 }

/** Present on a loaded card's root only, for the hover rules below; a skeleton never hovers. */
const HOVER_CLASS = "MitResourceCard"
const CARD_HOVER = `.${HOVER_CLASS}:hover &`

/**
 * Only `layout="responsive"` roots carry this container name, so rules under
 * {@link HORIZONTAL} never apply to a `layout="vertical"` card.
 */
const RESPONSIVE_CONTAINER = "resource-card-responsive"
/**
 * Container queries measure the root's content box. The root has no border or
 * padding, so this is the card's outer width.
 */
const HORIZONTAL = `@container ${RESPONSIVE_CONTAINER} (min-width: 600px)`
/** Cards 240px wide or narrower: the 190px carousel size, or a fill card in a narrow grid cell. */
const NARROW = "@container (max-width: 240px)"

/**
 * For unsized cards: the full viewport on phones, else at most 600px, since a
 * card turns horizontal at 600px and the search grid has 2+ columns from a
 * 600px viewport up.
 */
const IMAGE_SIZES = "(max-width: 600px) 100vw, 600px"

/** Every action's target; the design draws smaller buttons. */
const ACTION_TARGET = 32
/** The icon the design draws. */
const ACTION_ICON = 18

type RootProps = {
  layout: CardLayoutProps["layout"]
  size?: ResourceCardSize
}

/**
 * The root is the query container for the layout switch and narrow tweaks,
 * and the containing block for the title link's stretched `::after`. Nothing
 * between it and the link may be positioned, or the overlay would shrink to
 * that element.
 */
const Root = styled("div", {
  shouldForwardProp: (prop) => prop !== "layout" && prop !== "size",
})<RootProps>(({ theme, layout, size }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  width: size ? WIDTHS[size] : undefined,
  // Size containment gives the root a min-content width of 0, so a flex item
  // (a carousel slide) would otherwise shrink below `width`.
  minWidth: size ? WIDTHS[size] : undefined,
  containerType: "inline-size",
  containerName: layout === "responsive" ? RESPONSIVE_CONTAINER : undefined,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "4px",
  overflow: "hidden",
  overflowWrap: "break-word",
  [`&.${HOVER_CLASS}:hover`]: {
    boxShadow: "0 4px 12px rgb(33 35 38 / 5%)",
  },
}))

type GridProps = {
  /** Horizontal only: the price panel shows, so it gets a column. */
  priceColumn: boolean
}

const Grid = styled("div", {
  shouldForwardProp: (prop) => prop !== "priceColumn",
})<GridProps>(({ theme, priceColumn }) => ({
  flexGrow: 1,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "inherit",
  [CARD_HOVER]: { borderColor: theme.custom.colors.silverGrayLight },
  display: "grid",
  gridTemplateAreas: '"image" "content" "price"',
  gridTemplateColumns: "minmax(0, 1fr)",
  gridTemplateRows: "auto 1fr auto",
  [HORIZONTAL]: {
    gridTemplateAreas: priceColumn
      ? '"image content price"'
      : '"image content"',
    gridTemplateColumns: priceColumn
      ? "190px minmax(0, 1fr) 168px"
      : "190px minmax(0, 1fr)",
    gridTemplateRows: "auto",
    padding: "16px",
  },
}))

/** Past 190px tall, vertical images crop wider rather than grow. */
const ImageFrame = styled.div(({ theme }) => ({
  gridArea: "image",
  // An explicit width: a grid item with an aspect ratio doesn't stretch, and
  // the height cap would otherwise narrow the frame.
  width: "100%",
  aspectRatio: "343 / 166",
  maxHeight: "190px",
  overflow: "hidden",
  backgroundColor: theme.custom.colors.lightGray1,
  [NARROW]: {
    aspectRatio: "190 / 110",
    maxHeight: "none",
  },
  [HORIZONTAL]: {
    alignSelf: "center",
    aspectRatio: "auto",
    height: "120px",
    borderRadius: "4px",
  },
}))

const PlaceholderIcon = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: theme.custom.colors.darkGray2,
  svg: { width: "32px", height: "32px" },
}))

const PlaceholderDetails = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  height: "100%",
  padding: "12px",
  boxSizing: "border-box",
  textAlign: "center",
  overflow: "hidden",
})

const PlaceholderLabel = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  [NARROW]: { ...theme.typography.body3 },
}))

const PlaceholderValue = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray1,
  [NARROW]: { ...theme.typography.subtitle2 },
}))

const Image = styled(NextImage)({
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
})

/**
 * The footer sits at the bottom whenever the card is taller than its content (a
 * taller neighbour in a row, or a horizontal card's image or price panel).
 */
const Content = styled.div({
  gridArea: "content",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: "16px",
  padding: "16px",
  [NARROW]: {
    gap: "8px",
    padding: "12px",
  },
  [HORIZONTAL]: {
    gap: "12px",
    padding: "8px 16px",
  },
})

/** The metadata, with the actions beside it, the last one beside its last line. */
const Footer = styled.div({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "flex-end",
  gap: "16px",
})

const TitleBlock = styled.div({
  display: "flex",
  flexDirection: "column",
  [NARROW]: { gap: "4px" },
})

const TypeLabel = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
}))

/**
 * Hover colors and underlines the heading, which the link inherits, so it
 * survives hosts that reset link styles, as articles do for embeds.
 *
 * The heading reserves no height for a longer title. The results grid and the
 * carousels stretch each card to the tallest beside it, so they stay level,
 * and a card in a column is only as tall as its own title.
 */
const Heading = styled.h2(({ theme }) => ({
  ...theme.typography.subtitle1,
  lineHeight: 1.5,
  margin: 0,
  color: theme.custom.colors.darkGray2,
  [NARROW]: { ...theme.typography.subtitle2 },
  [CARD_HOVER]: {
    color: theme.custom.colors.red,
    textDecoration: "underline",
  },
}))

/**
 * The link, not the heading, clamps: `overflow: hidden` on the heading would
 * clip the link's focus ring, and an element's own overflow never clips its
 * own outline.
 */
const TitleLink = styled(LinkAdapter)({
  color: "inherit",
  textDecoration: "none",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
  },
})

const Secondary = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  marginTop: "4px",
  color: theme.custom.colors.silverGrayDark,
  [NARROW]: { marginTop: 0 },
}))

/** Flows in a row, wrapping, but stacks in a narrow card. */
const Metadata = styled.dl(({ theme }) => ({
  ...theme.typography.body3,
  flex: 1,
  minWidth: 0,
  margin: 0,
  display: "flex",
  flexWrap: "wrap",
  gap: "4px 12px",
  color: theme.custom.colors.darkGray2,
  "& > div": {
    display: "flex",
    // A value too long to follow its term starts its own line, rather than
    // breaking mid-word beside it.
    flexWrap: "wrap",
    gap: "4px",
    // A flex item won't shrink below its min-content width (the term plus the
    // value's longest word), so a long unbroken value would overflow under the
    // actions instead of wrapping.
    minWidth: 0,
  },
  "dt, dd": { margin: 0 },
  dt: {
    flexShrink: 0,
    color: theme.custom.colors.silverGrayDark,
  },
  dd: { minWidth: 0 },
  [NARROW]: {
    flexDirection: "column",
    // A wrapping column sizes its rows to the widest one rather than to the
    // list, so a long row would push them all past it, under the actions.
    flexWrap: "nowrap",
  },
}))

type PriceProps = {
  tone: PricePanel["tone"]
  /** The panel has no price lines. */
  empty: boolean
}

const Price = styled("div", {
  shouldForwardProp: (prop) => prop !== "tone" && prop !== "empty",
})<PriceProps>(({ theme, tone, empty }) => {
  const { colors } = theme.custom
  const border = `1px solid ${colors.lightGray2}`
  const dark = tone === "dark"
  // Only the light vertical panel is set off from the content: the dark one
  // is set off by its color, the white (no price) one is meant to read as part
  // of the card, and a horizontal panel is inset.
  const divided = tone === "light"
  return {
    gridArea: "price",
    display: empty ? "none" : "block",
    padding: "12px 16px",
    backgroundColor: {
      dark: colors.darkGray2,
      light: colors.lightGray0,
      neutral: colors.white,
    }[tone],
    color: dark ? colors.white : colors.darkGray2,
    borderTop: divided ? border : undefined,
    [NARROW]: {
      padding: "8px 12px",
    },
    [HORIZONTAL]: {
      display: empty ? "none" : "flex",
      flexDirection: "column",
      justifyContent: "center",
      borderTop: "none",
      borderRadius: "4px",
    },
  }
})

const Lines = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
})

const PrimaryLine = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  lineHeight: 1.5,
  [NARROW]: { ...theme.typography.subtitle2 },
}))

const PriceLine = styled("span", {
  shouldForwardProp: (prop) => prop !== "tone",
})<{ tone: PricePanel["tone"] }>(({ theme, tone }) => {
  const { colors } = theme.custom
  const dark = tone === "dark"
  return {
    ...theme.typography.body2,
    display: "flex",
    alignItems: "flex-start",
    gap: "4px",
    color: dark ? colors.white : colors.silverGrayDark,
    [NARROW]: { ...theme.typography.body3 },
    [HORIZONTAL]: {
      ...theme.typography.subtitle2,
      color: dark ? colors.silverGrayLight : colors.silverGrayDark,
    },
  }
})

// A price range must not break after its dash and strand the second amount on
// the next line. Non-breaking spaces around the dash do not stop that: Chrome
// still breaks after an en dash. An inline-block moves to the next line whole,
// and breaks inside only when it is wider than a line, where `nowrap` would
// spill past the panel ("$12,500.00 – $25,000.00").
const KeepTogether = styled.span({ display: "inline-block" })

const CertificateIcon = styled(RiAwardLine)({
  width: "16px",
  height: "16px",
  // Centres the 16px icon on the 18px vertical line.
  marginBlock: "1px",
  flexShrink: 0,
  [NARROW]: { marginBlock: 0 },
  [HORIZONTAL]: {
    width: "18px",
    height: "18px",
    marginBlock: 0,
  },
})

/**
 * Above the title link's stretched overlay, so clicks reach the buttons.
 * Stacked, so they take one icon's width from the metadata, except in a
 * horizontal card, which has the width for a row.
 */
const Actions = styled.div({
  flex: "none",
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  [HORIZONTAL]: { flexDirection: "row" },
})

/**
 * A bare 18px icon in a box one metadata line tall, so the last icon centres
 * on the last metadata line at any font size. The negative margins grow the
 * target to 32px without moving anything.
 */
const ActionButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "filled",
})<{ filled: boolean }>(({ theme, filled }) => {
  const { colors } = theme.custom
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: ACTION_TARGET,
    height: ACTION_TARGET,
    marginInline: (ACTION_ICON - ACTION_TARGET) / 2,
    marginBlock: `calc((${theme.typography.body3.lineHeight} - ${ACTION_TARGET}px) / 2)`,
    padding: 0,
    border: "none",
    // Rounds the focus outline.
    borderRadius: "50%",
    backgroundColor: "transparent",
    cursor: "pointer",
    color: filled ? colors.red : colors.darkGray1,
    svg: { width: ACTION_ICON, height: ACTION_ICON },
    "&:hover": { color: filled ? colors.mitRed : colors.red },
  }
})

/**
 * `layout="vertical"` always stacks image, content, and price panel.
 * `layout="responsive"` does too until the card is wide enough, then puts
 * them in a row. The switch is a container query on the card's own width.
 *
 * The parent must not size the card to fit its contents (a row flex item with
 * no basis, inline-block, a float, absolute positioning, `justify-items:
 * start`) unless `size` is set: the root is an `inline-size` container, so its
 * contents don't give it a width.
 *
 * The title link's description includes the metadata list and price panel as
 * whole regions, so anything added to either joins it.
 */
const ResourceCardView: React.FC<ResourceCardViewProps> = ({
  title,
  typeLabel,
  parentCourseName,
  imageSrc,
  placeholderIcon,
  placeholderDetails,
  metadata,
  price,
  lang,
  layout,
  size,
  href,
  pushUrl,
  onLinkClick,
  actions = [],
  headingLevel,
  className,
}) => {
  const typeId = useId()
  const parentId = useId()
  const metadataId = useId()
  const priceId = useId()
  const image = useImageWithFallback(imageSrc, DEFAULT_RESOURCE_IMG)

  const describedBy = [
    typeId,
    parentCourseName && parentId,
    metadata.length > 0 && metadataId,
    priceId,
  ]
    .filter(Boolean)
    .join(" ")
  const priceEmpty = !price.primary && !price.certificate && !price.license

  return (
    <Root
      className={classnames(HOVER_CLASS, className)}
      layout={layout}
      size={size}
    >
      <Grid priceColumn={!priceEmpty}>
        <ImageFrame>
          {!imageSrc && placeholderDetails ? (
            <PlaceholderDetails>
              {placeholderDetails.label && (
                <PlaceholderLabel>{placeholderDetails.label}</PlaceholderLabel>
              )}
              <PlaceholderValue>{placeholderDetails.value}</PlaceholderValue>
            </PlaceholderDetails>
          ) : !imageSrc && placeholderIcon ? (
            <PlaceholderIcon aria-hidden>{placeholderIcon}</PlaceholderIcon>
          ) : (
            <Image
              src={image.src}
              unoptimized={image.unoptimized}
              onError={image.onError}
              alt=""
              width={600}
              height={290}
              sizes={size ? `${WIDTHS[size]}px` : IMAGE_SIZES}
            />
          )}
        </ImageFrame>
        <Content>
          <TitleBlock>
            <TypeLabel id={typeId}>{typeLabel}</TypeLabel>
            <Heading as={`h${headingLevel}`} lang={lang}>
              <TitleLink
                href={href}
                pushUrl={pushUrl}
                onClick={onLinkClick}
                aria-describedby={describedBy}
              >
                {title}
              </TitleLink>
            </Heading>
            {parentCourseName && (
              <Secondary id={parentId}>From {parentCourseName}</Secondary>
            )}
          </TitleBlock>
          {(metadata.length > 0 || actions.length > 0) && (
            <Footer>
              {metadata.length > 0 && (
                <Metadata id={metadataId}>
                  {metadata.map(({ label, value }) => (
                    <div key={label}>
                      <dt>{label}:</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </Metadata>
              )}
              {actions.length > 0 && (
                <Actions>
                  {actions.map((action, index) => (
                    <ActionButton
                      // Not the label: it changes with membership, and a new
                      // key remounts the button, dropping its focus.
                      key={index}
                      type="button"
                      aria-label={action.label}
                      aria-haspopup="dialog"
                      filled={action.filled}
                      onClick={action.onClick}
                    >
                      {action.icon}
                    </ActionButton>
                  ))}
                </Actions>
              )}
            </Footer>
          )}
        </Content>
        <Price id={priceId} tone={price.tone} empty={priceEmpty}>
          <Lines>
            {price.primary && <PrimaryLine>{price.primary}</PrimaryLine>}
            {price.certificate && (
              <PriceLine tone={price.tone}>
                {price.tone === "dark" && <CertificateIcon aria-hidden />}
                {/* One flex item, so the text and its price wrap as prose. */}
                <span>
                  {price.certificate}
                  {price.certificatePrice && (
                    <>
                      {": "}
                      <KeepTogether>{price.certificatePrice}</KeepTogether>
                    </>
                  )}
                </span>
              </PriceLine>
            )}
            {price.license && (
              <PriceLine tone={price.tone}>{price.license}</PriceLine>
            )}
          </Lines>
        </Price>
      </Grid>
    </Root>
  )
}

/**
 * Placeholder for a loading {@link ResourceCardView}, laid out by the same
 * grid.
 */
const ResourceCardSkeleton: React.FC<
  CardLayoutProps & { className?: string }
> = ({ className, layout, size }) => {
  return (
    <Root className={className} layout={layout} size={size}>
      <Grid priceColumn>
        <ImageFrame>
          <Skeleton variant="rectangular" width="100%" height="100%" />
        </ImageFrame>
        <Content>
          <TitleBlock>
            <Skeleton variant="text" width="30%" />
            <Heading as="div">
              <Skeleton variant="text" width="90%" />
            </Heading>
          </TitleBlock>
          <Skeleton variant="text" width="60%" />
        </Content>
        <Price tone="neutral" empty={false}>
          <Lines>
            <Skeleton variant="text" width="50%" />
            <Skeleton variant="text" width="80%" />
          </Lines>
        </Price>
      </Grid>
    </Root>
  )
}

export { ResourceCardView, ResourceCardSkeleton, freePanel, startsMetadata }
export type {
  ResourceCardSize,
  CardLayoutProps,
  MetadataItem,
  PricePanel,
  CardAction,
  HeadingLevel,
  ResourceCardContent,
  ResourceCardViewProps,
}
