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
}
/**
 * Render a NextJS link if href is provided, otherwise a span.
 * Does not scroll if the href is a query string.
 */
export const Linkable: React.FC<LinkableProps> = ({
  href,
  children,
  className,
  ...others
}) => {
  if (href) {
    return (
      <Link
        {...others}
        className={className}
        href={href}
        scroll={!href.startsWith("?")}
      >
        {children}
      </Link>
    )
  }
  return (
    <span {...others} className={className}>
      {children}
    </span>
  )
}

export const BaseContainer = styled.div<{ display?: CSSProperties["display"] }>(
  ({ theme, onClick, display = "block" }) => [
    {
      borderRadius: "8px",
      border: `1px solid ${theme.custom.colors.lightGray2}`,
      background: theme.custom.colors.white,
      display,
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

const titleOpts = {
  shouldForwardProp: (prop: string) => prop !== "lines" && prop !== "size",
}
const Title = styled(Linkable, titleOpts)<{ lines?: number; size?: Size }>`
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
export const useClickChildLink = (
  onClick?: React.MouseEventHandler<HTMLElement>,
): React.MouseEventHandler<HTMLElement> => {
  return useCallback(
    (e) => {
      onClick?.(e)
      if (!e.currentTarget.contains(e.target as Node)) {
        // This happens if click target is a child in React tree but not DOM tree
        // This can happen with portals.
        // In such cases, data-card-actions won't be a parent of the target.
        return
      }
      const anchor = e.currentTarget.querySelector<HTMLAnchorElement>(
        'a[data-card-link="true"]',
      )
      const target = e.target as HTMLElement
      if (!anchor || target.closest("a, button, [data-card-action]")) return
      if (e.metaKey || e.ctrlKey) {
        /**
         * Enables ctrl+click to open card's link in new tab.
         * Without this, ctrl+click only works on the anchor itself.
         */
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
    [onClick],
  )
}

type CardProps = {
  children: ReactNode[] | ReactNode
  className?: string
  size?: Size
  /**
   * Defaults to `false`. If `true`, clicking the whole card will click the
   * child anchor with data-card-link="true".
   *
   * NOTES:
   *  - By default, Card.Title has `data-card-link="true"`.
   *  - If using Card.Content to customize, you must ensure the content includes
   *  an anchor with data-card-link attribute. Its value is irrelevant.
   *  - Clicks will NOT be forwarded if it is (or is a child of):
   *    - an anchor or button element
   *    - OR an element with data-card-action
   */
  forwardClicksToLink?: boolean
  onClick?: React.MouseEventHandler<HTMLElement>
  as?: React.ElementType
} & AriaAttributes

export type ImageProps = NextImageProps & {
  size?: Size
  height?: number | string
  style?: CSSProperties
}
type TitleProps = {
  children?: ReactNode
  href?: string
  lines?: number
  style?: CSSProperties
}

type SlotProps = { children?: ReactNode; style?: CSSProperties }

type Card = FC<CardProps> & {
  Content: FC<{ children: ReactNode }>
  Image: FC<ImageProps>
  Info: FC<SlotProps>
  Title: FC<TitleProps>
  Footer: FC<SlotProps>
  Actions: FC<SlotProps>
}

const Card: Card = ({
  children,
  className,
  size,
  onClick,
  forwardClicksToLink = false,
  ...others
}) => {
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

  const handleHrefClick = useClickChildLink(onClick)
  const handleClick = forwardClicksToLink ? handleHrefClick : onClick

  const allClassNames = ["MitCard-root", className ?? ""].join(" ")

  if (content) {
    return (
      <Container
        {...others}
        className={allClassNames}
        size={size}
        onClick={handleClick}
      >
        {content}
      </Container>
    )
  }

  return (
    <Container
      {...others}
      className={allClassNames}
      size={size}
      onClick={handleClick}
    >
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
        <Title
          data-card-link={!!title.href}
          className="MitCard-title"
          size={size}
          {...title}
        >
          {title.children}
        </Title>
      </Body>
      <Bottom>
        <Footer className="MitCard-footer" {...footer}>
          {footer.children}
        </Footer>
        {actions.children && (
          <Actions className="MitCard-actions" data-card-actions {...actions}>
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
