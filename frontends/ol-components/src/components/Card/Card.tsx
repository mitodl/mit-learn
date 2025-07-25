import React, {
  FC,
  ReactNode,
  Children,
  isValidElement,
  CSSProperties,
  useCallback,
  AriaAttributes,
  ReactElement,
} from "react"
import styled from "@emotion/styled"
import { theme } from "../ThemeProvider/ThemeProvider"
import { pxToRem } from "../ThemeProvider/typography"
import { Link } from "../Link/Link"
import { default as NextImage, ImageProps as NextImageProps } from "next/image"
import { truncateText } from "../TruncateText/TruncateText"

export type Size = "small" | "medium"

type LinkableProps = {
  href?: string
  children?: ReactNode
  className?: string
}
/**
 * Render a NextJS link if href is provided, otherwise a span.
 * Passes shallow to navigate with window.history.pushState
 * where we are only updating search params to prevent calls
 * to the server for RSC payloads.
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
        color="black"
        {...others}
        className={className}
        href={href}
        shallow={href.startsWith("?")}
        nohover
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
const Title = styled(
  Linkable,
  titleOpts,
)<{ size?: Size; lines?: number }>(({ theme, size, lines = 3 }) => {
  return [
    {
      display: "flex",
      textOverflow: "ellipsis",
      overflow: "hidden",
      margin: 0,
      ...truncateText(lines),
    },
    size === "small"
      ? {
          ...theme.typography.subtitle2,
          height: `calc(${lines} * ${theme.typography.subtitle2.lineHeight})`,
        }
      : {
          ...theme.typography.subtitle1,
          height: `calc(${lines} * ${theme.typography.subtitle1.lineHeight})`,
        },
  ]
})

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
  lang?: string
}

type SlotProps = { children?: ReactNode; style?: CSSProperties }

/**
 * Card component with slots for image, info, title, footer, and actions:
 * ```tsx
 * <Card>
 *  <Card.Image src="image-url" />
 * <Card.Info>Info</Card.Info>
 * <Card.Title href="link-url">Title</Card.Title>
 * <Card.Footer>Footer</Card.Footer>
 * <Card.Actions>Actions</Card.Actions>
 * </Card>
 * ```
 *
 * **Links:** Card.Title will be a link if `href` is supplied; the entire card
 * will be clickable if `forwardClicksToLink` is `true`.
 *
 * **Custom Layout:** Use Card.Content to create a custom layout.
 */
type Card = FC<CardProps> & {
  Content: FC<{ children: ReactNode }>
  Image: FC<ImageProps>
  Info: FC<SlotProps>
  /**
   * Card title with optional `href`.
   */
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
    const element = child as ReactElement<{ children?: ReactNode }>
    if (element.type === Content) content = element.props.children
    else if (element.type === Image) image = element.props as ImageProps
    else if (element.type === Info) info = element.props as SlotProps
    else if (element.type === Title) title = element.props as TitleProps
    else if (element.type === Footer) footer = element.props as SlotProps
    else if (element.type === Actions) actions = element.props as SlotProps
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
        />
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
export type { CardProps }
