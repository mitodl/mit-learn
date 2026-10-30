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

const freeToAuditPanel = (
  certificateType: string,
  certificatePrice: string | null | undefined,
  license?: string,
): PricePanel => ({
  tone: "light",
  primary: "Free to audit",
  certificate: certificatePrice
    ? `${certificateType}: ${certificatePrice}`
    : certificateType,
  license,
})

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
  metadata: MetadataItem[]
  price: PricePanel
  lang?: string
}

type ResourceCardViewProps = ResourceCardContent &
  CardLayoutProps & {
    href: string
    pushUrl?: PushUrl
    onLinkClick?: React.MouseEventHandler<HTMLAnchorElement>
    actions: CardAction[]
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

/** Distance from the action buttons to the edges of the cell they share. */
const ACTION_INSET = 12
const ACTION_SIZE = 32
/** The band an action button occupies, measured in from the edges of its cell. */
const ACTION_BAND = ACTION_INSET + ACTION_SIZE
/** Between a price line and an action button beside it. */
const ACTION_GAP = 8
const PRICE_PADDING_BLOCK = 12
const PRICE_PADDING_INLINE = 16
/** The primary price line's leading, as a multiple of its font size. */
const PRIMARY_LEADING = 1.5

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

const Image = styled(NextImage)({
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
})

/**
 * Metadata sits at the bottom whenever the card is taller than its content (a
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
 * `minHeight` reserves the three lines the link clamps to, so vertical titles
 * always take them.
 */
const Heading = styled.h2(({ theme }) => ({
  ...theme.typography.subtitle1,
  lineHeight: 1.5,
  minHeight: "4.5em",
  margin: 0,
  color: theme.custom.colors.darkGray2,
  [NARROW]: {
    ...theme.typography.subtitle2,
    minHeight: `calc(3 * ${theme.typography.subtitle2.lineHeight})`,
  },
  [HORIZONTAL]: { minHeight: 0 },
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
  WebkitLineClamp: 3,
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

const Metadata = styled.dl(({ theme }) => ({
  ...theme.typography.body3,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  color: theme.custom.colors.darkGray2,
  "& > div": {
    display: "flex",
    gap: "4px",
  },
  "dt, dd": { margin: 0 },
  dt: {
    flexShrink: 0,
    color: theme.custom.colors.silverGrayDark,
  },
  dd: { minWidth: 0 },
  [HORIZONTAL]: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "8px 12px",
  },
}))

type PriceProps = {
  tone: PricePanel["tone"]
  /** The panel has no price lines. */
  empty: boolean
  /** Horizontal: the actions share this cell. */
  reserveActions: boolean
}

const Price = styled("div", {
  shouldForwardProp: (prop) =>
    prop !== "tone" && prop !== "empty" && prop !== "reserveActions",
})<PriceProps>(({ theme, tone, empty, reserveActions }) => {
  const { colors } = theme.custom
  const border = `1px solid ${colors.lightGray2}`
  const dark = tone === "dark"
  // Only the light vertical panel is set off from the content: the dark one
  // is set off by its color, the white (no price) one is meant to read as part
  // of the card, and a horizontal panel is inset.
  const divided = tone === "light"
  // Horizontal: the band the actions occupy is at the panel's top right, and
  // the lines are centred, so the first line can run through the band. It
  // reserves the actions' width, and the top row's floor keeps it low enough
  // that the second line starts below the band, whatever the panel's height.
  // That is what a float at the top right would do, but a float moves with
  // the centred lines and the actions must not. The floor is sized against
  // the primary line; the one panel without one (neutral, certificate only)
  // has a single line.
  const firstLineFloor = `calc(${ACTION_BAND - PRICE_PADDING_BLOCK}px - ${PRIMARY_LEADING} * ${theme.typography.subtitle1.fontSize})`
  return {
    gridArea: "price",
    display: empty ? "none" : "block",
    padding: `${PRICE_PADDING_BLOCK}px ${PRICE_PADDING_INLINE}px`,
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
      display: empty && !reserveActions ? "none" : "grid",
      // Slack, the lines, slack: equal slack centres the lines. The column
      // must not grow to a long word's min-content, or the lines leave the
      // panel instead of wrapping.
      gridTemplateColumns: "minmax(0, 1fr)",
      gridTemplateRows: `minmax(${reserveActions ? firstLineFloor : 0}, 1fr) auto minmax(0, 1fr)`,
      borderTop: "none",
      borderRadius: "4px",
    },
  }
})

const Lines = styled("div", {
  shouldForwardProp: (prop) => prop !== "reserveActions",
})<Pick<PriceProps, "reserveActions">>(({ reserveActions }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  [HORIZONTAL]: {
    gridRow: 2,
    "> :first-child": reserveActions
      ? {
          paddingInlineEnd: ACTION_BAND - PRICE_PADDING_INLINE + ACTION_GAP,
          // A price line is a flex box with its text as an anonymous item,
          // whose min-content is its longest word; beside the actions that
          // word may not fit, so let it break rather than reach them.
          overflowWrap: "anywhere",
        }
      : undefined,
  },
}))

const PrimaryLine = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  lineHeight: PRIMARY_LEADING,
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

/** Vertical: top-right of the image. Horizontal: top-right of the price panel. */
const Actions = styled.div({
  gridArea: "image",
  alignSelf: "start",
  justifySelf: "end",
  zIndex: 1,
  display: "flex",
  gap: "8px",
  margin: ACTION_INSET,
  [HORIZONTAL]: {
    gridArea: "price",
  },
})

type ActionButtonProps = {
  filled: boolean
  tone: PricePanel["tone"]
}

const ActionButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "filled" && prop !== "tone",
})<ActionButtonProps>(({ theme, filled, tone }) => {
  const { colors } = theme.custom
  const outlined = (border: string, icon: string, hover: string) => ({
    backgroundColor: "transparent",
    borderColor: border,
    color: icon,
    "&:hover": {
      backgroundColor: "transparent",
      borderColor: hover,
      color: hover,
    },
  })
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    padding: 0,
    borderRadius: "50%",
    border: "1px solid transparent",
    cursor: "pointer",
    svg: { width: "16px", height: "16px" },
    ...(filled
      ? {
          backgroundColor: colors.red,
          color: colors.white,
          "&:hover": { backgroundColor: colors.mitRed },
        }
      : {
          backgroundColor: colors.white,
          color: colors.darkGray1,
          "&:hover": {
            backgroundColor: colors.lightGray2,
            color: colors.darkGray2,
          },
          [HORIZONTAL]:
            tone === "dark"
              ? outlined(colors.darkGray1, colors.silverGrayLight, colors.white)
              : outlined(
                  colors.lightGray2,
                  colors.silverGrayDark,
                  colors.darkGray1,
                ),
        }),
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
  metadata,
  price,
  lang,
  layout,
  size,
  href,
  pushUrl,
  onLinkClick,
  actions,
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
      <Grid priceColumn={!priceEmpty || actions.length > 0}>
        <ImageFrame>
          {!imageSrc && placeholderIcon ? (
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
        </Content>
        <Price
          id={priceId}
          tone={price.tone}
          empty={priceEmpty}
          reserveActions={actions.length > 0}
        >
          <Lines reserveActions={actions.length > 0}>
            {price.primary && <PrimaryLine>{price.primary}</PrimaryLine>}
            {price.certificate && (
              <PriceLine tone={price.tone}>
                {price.tone === "dark" && <CertificateIcon aria-hidden />}
                {price.certificate}
              </PriceLine>
            )}
            {price.license && (
              <PriceLine tone={price.tone}>{price.license}</PriceLine>
            )}
          </Lines>
        </Price>
        {/* Last in the DOM, so Tab reaches the card link before the actions. */}
        {actions.length > 0 && (
          <Actions>
            {actions.map(({ label, filled, icon, onClick }, index) => (
              <ActionButton
                // Not the label: it changes with state ("Bookmark" /
                // "Bookmarked"), which would remount the button and drop
                // focus when its dialog closes.
                key={index}
                type="button"
                aria-label={label}
                aria-haspopup="dialog"
                filled={filled}
                tone={price.tone}
                onClick={onClick}
              >
                {icon}
              </ActionButton>
            ))}
          </Actions>
        )}
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
        <Price tone="neutral" empty={false} reserveActions={false}>
          <Lines reserveActions={false}>
            <Skeleton variant="text" width="50%" />
            <Skeleton variant="text" width="80%" />
          </Lines>
        </Price>
      </Grid>
    </Root>
  )
}

export {
  ResourceCardView,
  ResourceCardSkeleton,
  startsMetadata,
  freeToAuditPanel,
}
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
