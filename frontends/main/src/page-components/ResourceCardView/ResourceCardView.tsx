import React, { useId } from "react"
import { default as NextImage } from "next/image"
import { RiAwardFill } from "@remixicon/react"
import { LinkAdapter, Skeleton, styled } from "ol-components"
import type { PushUrl } from "ol-components"
import { DEFAULT_RESOURCE_IMG, useImageWithFallback } from "ol-utilities"

type ResourceCardSize = "small" | "medium"

/**
 * `size` fixes the card's width and is only available with the vertical
 * layout. With no `size`, the card fills its container.
 */
type CardLayoutProps =
  | { layout: "vertical"; size?: ResourceCardSize }
  | { layout: "responsive"; size?: never }

type MetadataItem = {
  label: string
  value: React.ReactNode
  /** The label stays visible at narrow widths. */
  keepLabel?: boolean
}

type PricePanel = {
  tone: "dark" | "light" | "neutral"
  primary?: string
  certificate?: string
  license?: string
}

type CardAction = {
  label: string
  filled: boolean
  icon: React.ReactNode
  onClick: React.MouseEventHandler<HTMLButtonElement>
}

type ResourceCardContent = {
  title: string
  typeLabel: string
  parentCourseName?: string
  imageSrc: string | null
  metadata: MetadataItem[]
  price: PricePanel
  lang?: string
}

type ResourceCardViewProps = ResourceCardContent &
  CardLayoutProps & {
    href?: string
    pushUrl?: PushUrl
    onLinkClick?: React.MouseEventHandler<HTMLAnchorElement>
    actions: CardAction[]
    headingLevel: number
    className?: string
  }

const WIDTHS: Record<ResourceCardSize, number> = { small: 190, medium: 300 }

/**
 * Up to the full viewport on phones, else up to 600px: a responsive card
 * turns horizontal at 600px, and the search cards grid has 2+ columns from a
 * 600px viewport up.
 */
const IMAGE_SIZES = "(max-width: 600px) 100vw, 600px"

type RootProps = {
  layout: CardLayoutProps["layout"]
  size?: ResourceCardSize
}

const Root = styled("div", {
  shouldForwardProp: (prop) => prop !== "layout" && prop !== "size",
})<RootProps>(({ theme, size }) => ({
  display: "flex",
  flexDirection: "column",
  width: size ? WIDTHS[size] : undefined,
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "4px",
  overflow: "hidden",
}))

const Image = styled(NextImage)(({ theme }) => ({
  display: "block",
  width: "100%",
  height: "auto",
  aspectRatio: "16 / 9",
  objectFit: "cover",
  backgroundColor: theme.custom.colors.lightGray1,
}))

const Content = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "16px",
})

const TypeLabel = styled.span(({ theme }) => ({
  ...theme.typography.subtitle4,
  color: theme.custom.colors.silverGrayDark,
}))

const Heading = styled.h2(({ theme }) => ({
  ...theme.typography.subtitle1,
  margin: 0,
  color: theme.custom.colors.darkGray2,
}))

const TitleLink = styled(LinkAdapter)({
  color: "inherit",
  textDecoration: "none",
})

const Secondary = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
}))

const Metadata = styled.dl(({ theme }) => ({
  ...theme.typography.body3,
  margin: 0,
  color: theme.custom.colors.darkGray2,
  "dt, dd": { display: "inline", margin: 0 },
  dt: { color: theme.custom.colors.silverGrayDark, marginRight: "4px" },
}))

const Price = styled("div", {
  shouldForwardProp: (prop) => prop !== "tone",
})<{ tone: PricePanel["tone"] }>(({ theme, tone }) => ({
  ...theme.typography.subtitle2,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "16px",
  ...{
    dark: {
      backgroundColor: theme.custom.colors.darkGray2,
      color: theme.custom.colors.white,
    },
    light: {
      backgroundColor: theme.custom.colors.lightGray0,
      color: theme.custom.colors.darkGray2,
      borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
    },
    neutral: {
      backgroundColor: theme.custom.colors.white,
      color: theme.custom.colors.darkGray2,
    },
  }[tone],
}))

const PriceLine = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  display: "flex",
  alignItems: "center",
  gap: "4px",
  svg: { width: "16px", height: "16px", flexShrink: 0 },
}))

const Actions = styled.div({
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  padding: "0 16px 16px",
})

const ActionButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "filled",
})<{ filled: boolean }>(({ theme, filled }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  padding: 0,
  borderRadius: "50%",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  color: filled ? theme.custom.colors.mitRed : theme.custom.colors.darkGray2,
  cursor: "pointer",
  svg: { width: "20px", height: "20px" },
}))

/**
 * A learning resource card: image, type, linked title, metadata, a price
 * panel, and action buttons.
 *
 * The title link is described by the type label, the "From …" line, the
 * metadata list, and the price panel as whole regions, so any item added to
 * `metadata` or the price panel joins the description. Actions come last in
 * the DOM, so Tab reaches the card link before them.
 */
const ResourceCardView: React.FC<ResourceCardViewProps> = ({
  title,
  typeLabel,
  parentCourseName,
  imageSrc,
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
  const level = Math.min(Math.max(headingLevel, 1), 6)

  const describedBy = [
    typeId,
    parentCourseName && parentId,
    metadata.length > 0 && metadataId,
    priceId,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <Root className={className} layout={layout} size={size}>
      <Image
        src={image.src}
        unoptimized={image.unoptimized}
        onError={image.onError}
        alt=""
        width={600}
        height={338}
        sizes={IMAGE_SIZES}
      />
      <Content>
        <TypeLabel id={typeId}>{typeLabel}</TypeLabel>
        <Heading as={`h${level}` as "h2"} lang={lang}>
          {href ? (
            <TitleLink
              href={href}
              pushUrl={pushUrl}
              onClick={onLinkClick}
              aria-describedby={describedBy}
            >
              {title}
            </TitleLink>
          ) : (
            title
          )}
        </Heading>
        {parentCourseName && (
          <Secondary id={parentId}>From {parentCourseName}</Secondary>
        )}
        {metadata.length > 0 && (
          <Metadata id={metadataId}>
            {metadata.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </Metadata>
        )}
      </Content>
      <Price id={priceId} tone={price.tone}>
        {price.primary && <span>{price.primary}</span>}
        {price.certificate && (
          <PriceLine>
            <RiAwardFill aria-hidden />
            {price.certificate}
          </PriceLine>
        )}
        {price.license && <PriceLine>{price.license}</PriceLine>}
      </Price>
      {actions.length > 0 && (
        <Actions>
          {actions.map(({ label, filled, icon, onClick }) => (
            <ActionButton
              key={label}
              type="button"
              aria-label={label}
              aria-haspopup="dialog"
              filled={filled}
              onClick={onClick}
            >
              {icon}
            </ActionButton>
          ))}
        </Actions>
      )}
    </Root>
  )
}

const SkeletonBlock = styled.div({ padding: "16px" })

/**
 * Placeholder for a loading {@link ResourceCardView}, with the same regions.
 */
const ResourceCardSkeleton: React.FC<
  CardLayoutProps & { className?: string }
> = ({ className, layout, size }) => {
  return (
    <Root className={className} layout={layout} size={size}>
      <Skeleton
        variant="rectangular"
        width="100%"
        height="auto"
        sx={{ aspectRatio: "16 / 9" }}
      />
      <Content>
        <Skeleton variant="text" width="30%" />
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="60%" />
      </Content>
      <SkeletonBlock>
        <Skeleton variant="text" width="40%" />
      </SkeletonBlock>
    </Root>
  )
}

export { ResourceCardView, ResourceCardSkeleton }
export type {
  ResourceCardSize,
  CardLayoutProps,
  MetadataItem,
  PricePanel,
  CardAction,
  ResourceCardContent,
  ResourceCardViewProps,
}
