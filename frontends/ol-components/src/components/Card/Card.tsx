import React, {
  FC,
  ReactNode,
  Children,
  isValidElement,
  CSSProperties,
  useCallback,
  AriaAttributes,
} from "react"
import styled from "@emotion/styled"
import { theme } from "../ThemeProvider/ThemeProvider"
import { pxToRem } from "../ThemeProvider/typography"
import Link from "next/link"
import { default as NextImage, ImageProps as NextImageProps } from "next/image"

export type Size = "small" | "medium"

type LinkableProps = {
  href?: string
  children?: ReactNode
  className?: string
} & Pick<AriaAttributes, "aria-label">
/**
 * Render a NextJS link if href is provided, otherwise a span.
 * Does not scroll if the href is a query string.
 */
export const Linkable: React.FC<LinkableProps> = ({
  href,
  children,
  className,
  "aria-label": ariaLabel,
}) => {
  if (href) {
    return (
      <Link
        aria-label={ariaLabel}
        className={className}
        href={href}
        scroll={!href.startsWith("?")}
      >
        {children}
      </Link>
    )
  }
  return <span className={className}>{children}</span>
}

/*
 *The relative positioned wrapper allows the action buttons to live adjacent to the
 * Link container in the DOM structure. They cannot be a descendent of it as
 * buttons inside anchors are not valid HTML.
 */
export const Wrapper = styled.div`
  position: relative;
`

export const BaseContainer = styled.div<{ display?: CSSProperties["display"] }>(
  ({ theme, onClick, display = "block" }) => [
    {
      borderRadius: "8px",
      border: `1px solid ${theme.custom.colors.lightGray2}`,
      background: theme.custom.colors.white,
      display,
      position: "relative",
      overflow: "hidden", // to clip image so they match border radius
    },
    onClick && {
      "&:hover": {
        borderColor: theme.custom.colors.silverGrayLight,
        boxShadow:
          "0 2px 4px 0 rgb(37 38 43 / 10%), 0 2px 4px 0 rgb(37 38 43 / 10%)",
        cursor: "pointer",
      },
    },
  ],
)
const CONTAINER_WIDTHS: Record<Size, number> = {
  small: 192,
  medium: 300,
}
const Container = styled(BaseContainer)<{ size?: Size }>(({ size }) => [
  size && {
    minWidth: CONTAINER_WIDTHS[size],
    maxWidth: CONTAINER_WIDTHS[size],
  },
])

const Content = () => <></>

const Body = styled.div`
  margin: 16px;
`

const Image = styled(NextImage)<{ height?: number | string; size?: Size }>`
  display: block;
  width: 100%;
  height: ${({ height, size }) =>
    height ?? (size === "small" ? "120px" : "170px")};
  background-color: ${theme.custom.colors.lightGray1};
  object-fit: cover;
`

const Info = styled.div<{ size?: Size }>`
  ${{ ...theme.typography.subtitle3 }}
  color: ${theme.custom.colors.silverGrayDark};
  display: flex;
  justify-content: space-between;
  margin-bottom: ${({ size }) => (size === "small" ? 4 : 8)}px;
`

const Title = styled(Linkable)<{ lines?: number; size?: Size }>`
  text-overflow: ellipsis;
  height: ${({ lines, size }) => {
    const lineHeightPx = size === "small" ? 18 : 20
    lines = lines ?? (size === "small" ? 2 : 3)
    return theme.typography.pxToRem(lines * lineHeightPx)
  }};
  overflow: hidden;
  margin: 0;

  ${({ size }) =>
    size === "small"
      ? { ...theme.typography.subtitle2 }
      : { ...theme.typography.subtitle1 }}

  ${({ lines, size }) => {
    lines = lines ?? (size === "small" ? 2 : 3)
    return `
      @supports (-webkit-line-clamp: ${lines}) {
        white-space: initial;
        display: -webkit-box;
        -webkit-line-clamp: ${lines};
        -webkit-box-orient: vertical;
      }`
  }}
`

const Footer = styled.span`
  display: block;
  height: ${pxToRem(16)};
  ${{
    ...theme.typography.body3,
    color: theme.custom.colors.silverGrayDark,
  }}
`

const Bottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin: 0 16px 16px;
  height: 32px;
`

const Actions = styled.div`
  display: flex;
  gap: 8px;
`

/**
 * Click the child anchor element if the click event target is not the anchor itself.
 *
 * Allows making a whole region clickable as a link, even if the link is not the
 * direct target of the click event.
 */
export const useClickChildHref = (
  href?: string,
  onClick?: React.MouseEventHandler<HTMLElement>,
): React.MouseEventHandler<HTMLElement> => {
  return useCallback(
    (e) => {
      onClick?.(e)
      const anchor = e.currentTarget.querySelector<HTMLAnchorElement>(
        `a[href="${href}"]`,
      )
      const target = e.target as HTMLElement
      if (!anchor || target.closest("a, button")) return
      if (e.metaKey || e.ctrlKey) {
        const opts: PointerEventInit = {
          bubbles: false,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
        }
        anchor.dispatchEvent(new PointerEvent("click", opts))
      } else {
        anchor.click()
      }
    },
    [href, onClick],
  )
}

type CardProps = {
  children: ReactNode[] | ReactNode
  className?: string
  size?: Size
  /**
   * If provided, the card will render its title as a link. The entire card will
   * be clickable, activating the link.
   */
  href?: string
  onClick?: React.MouseEventHandler<HTMLElement>
}

export type ImageProps = NextImageProps & {
  size?: Size
  height?: number | string
  style?: CSSProperties
}
type TitleProps = {
  children?: ReactNode
  lines?: number
  style?: CSSProperties
} & Pick<AriaAttributes, "aria-label">

type SlotProps = { children?: ReactNode; style?: CSSProperties }

type Card = FC<CardProps> & {
  Content: FC<{ children: ReactNode }>
  Image: FC<ImageProps>
  Info: FC<SlotProps>
  Title: FC<TitleProps>
  Footer: FC<SlotProps>
  Actions: FC<SlotProps>
}

const Card: Card = ({ children, className, size, href, onClick }) => {
  let content,
    image: ImageProps | null = null,
    info: SlotProps = {},
    title: TitleProps = {},
    footer: SlotProps = {},
    actions: SlotProps = {}

  /*
   * Allows rendering child elements to specific "slots":
   *   <Card>
   *      <Card.Title>
   *        <Title>The Title</Title>
   *      <Card.Title>
   *      <Card.Image src="url" />
   *   <Card>
   * Akin to alternative interface:
   *   <Card title={<Title>The Title</Title>} image={<Image src="url" />} />.
   *
   * An RFC here provides rationale: https://github.com/nihgwu/rfcs/blob/neo/slots/text/0000-slots.md
   */
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Content) content = child.props.children
    else if (child.type === Image) image = child.props
    else if (child.type === Info) info = child.props
    else if (child.type === Title) title = child.props
    else if (child.type === Footer) footer = child.props
    else if (child.type === Actions) actions = child.props
  })

  const hasHref = typeof href === "string"
  const handleHrefClick = useClickChildHref(href, onClick)
  const handleClick = hasHref ? handleHrefClick : onClick

  const allClassNames = ["MitCard-root", className ?? ""].join(" ")

  if (content) {
    return (
      <Container className={allClassNames} size={size} onClick={handleClick}>
        {content}
      </Container>
    )
  }

  return (
    <Container className={allClassNames} size={size} onClick={handleClick}>
      {image && (
        // alt text will be checked on Card.Image
        // eslint-disable-next-line styled-components-a11y/alt-text
        <Image
          className="MitCard-image"
          size={size}
          height={170}
          width={298}
          {...(image as ImageProps)}
        />
      )}
      <Body>
        {info.children && (
          <Info className="MitCard-info" size={size} {...info}>
            {info.children}
          </Info>
        )}
        <Title href={href} className="MitCard-title" size={size} {...title}>
          {title.children}
        </Title>
      </Body>
      <Bottom>
        <Footer className="MitCard-footer" {...footer}>
          {footer.children}
        </Footer>
        {actions.children && (
          <Actions className="MitCard-actions" {...actions}>
            {actions.children}
          </Actions>
        )}
      </Bottom>
    </Container>
  )
}

Card.Content = Content
Card.Image = Image
Card.Info = Info
Card.Title = Title
Card.Footer = Footer
Card.Actions = Actions

export { Card }
