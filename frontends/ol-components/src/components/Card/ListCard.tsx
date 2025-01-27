import React, {
  FC,
  ReactNode,
  Children,
  isValidElement,
  AriaAttributes,
} from "react"
import { styled } from "@pigment-css/react"
import { RiDraggable } from "@remixicon/react"
import { BaseContainer, ImageProps, useClickChildLink, Linkable } from "./Card"
import { TruncateText } from "../TruncateText/TruncateText"
import { ActionButton, ActionButtonProps } from "../Button/Button"
import { default as NextImage } from "next/image"

const Content = () => <></>

export const Body = styled("div")(({ theme }) => ({
  flexGrow: "1",
  margin: "24px",
  [theme.breakpoints.down("md")]: {
    margin: "12px",
  },

  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
}))

export const DragArea = styled("div")(({ theme }) => ({
  margin: "16px -6px 16px 16px",
  paddingRight: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRight: `1px solid ${theme.custom.colors.lightGray2}`,

  [theme.breakpoints.down("md")]: {
    margin: "12px 0 12px 12px",
    paddingRight: "4px",
  },

  svg: {
    fill: theme.custom.colors.silverGrayDark,
    width: "24px",
    height: "24px",
    [theme.breakpoints.down("md")]: {
      width: "20px",
      height: "20px",
    },
  },
}))

const Image = styled(NextImage)(({ theme }) => ({
  display: "block",
  width: "236px",
  height: "122px",
  margin: "24px 24px 24px 0",
  borderRadius: "4px",
  objectFit: "cover",
  [theme.breakpoints.down("md")]: {
    width: "111px",
    height: "104px",
    margin: "0",
    borderRadius: "0",
  },

  backgroundColor: theme.custom.colors.lightGray1,
  flexShrink: 0,
}))

export const Info = styled("div")(({ theme }) => ({
  ...theme.typography.subtitle3,
  marginBottom: "16px",
  [theme.breakpoints.down("md")]: {
    ...theme.typography.subtitle4,
    marginBottom: "8px",
  },

  color: theme.custom.colors.silverGrayDark,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}))

export type TitleProps = {
  children?: ReactNode
  href?: string
}
export const Title: React.FC<TitleProps> = styled(Linkable)(({ theme }) => ({
  flexGrow: 1,
  color: theme.custom.colors.darkGray2,
  textOverflow: "ellipsis",
  ...theme.typography.subtitle1,
  height: theme.typography.pxToRem(40),
  [theme.breakpoints.down("md")]: {
    ...theme.typography.subtitle2,
    height: theme.typography.pxToRem(32),
  },

  margin: 0,
}))

export const Footer = styled("span")(({ theme }) => ({
  display: "block",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
}))

export const Bottom = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  height: theme.typography.pxToRem(32),
  [theme.breakpoints.down("md")]: {
    height: theme.typography.pxToRem(18),
  },
}))

/**
 * Slot intended to contain ListCardAction buttons.
 */
export const Actions = styled("div")(({ theme }) => ({
  display: "flex",
  gap: "8px",
  [theme.breakpoints.down("md")]: {
    gap: "4px",
  },
}))

const ListCardActionButton = styled(ActionButton)<{ isMobile?: boolean }>(
  ({ theme }) => ({
    [theme.breakpoints.down("md")]: {
      borderStyle: "none",
      width: "24px",
      height: "24px",
      svg: {
        width: "16px",
        height: "16px",
      },
    },
  }),
)

type CardProps = {
  children: ReactNode[] | ReactNode
  className?: string
  /**
   * Defaults to `false`. If `true`, clicking the whole card will click the
   * child anchor with data-card-link.
   *
   * NOTES:
   *  - By default, Card.Title has `data-card-link="true"`.
   *  - If using Card.Content to customize, you must ensure the content includes
   *  an anchor with data-card-link attribute. Its value is irrelevant.
   *  - Clicks will NOT be forwarded if:
   *    - The click target is a child of Card.Actions OR an element with
   *    - The click target is a child of any element with data-card-actions attribute
   */
  forwardClicksToLink?: boolean
  draggable?: boolean
  onClick?: React.MouseEventHandler
  as?: React.ElementType
} & AriaAttributes

/**
 * Row-like card component with slots for image, info, title, footer, and actions:
 * ```tsx
 * <ListCard>
 *   <ListCard.Image src="image-url" />
 *   <ListCard.Info>Info</ListCard.Info>
 *   <ListCard.Title href="link-url">Title</ListCard.Title>
 *   <ListCard.Footer>Footer</ListCard.Footer>
 *   <ListCard.Actions>Actions</ListCard.Actions>
 * </ListCard>
 * ```
 *
 * **Links:** Card.Title will be a link if `href` is supplied; the entire card
 * will be clickable if `forwardClicksToLink` is `true`.
 *
 * **Custom Layout:** Use ListCard.Content to create a custom layout.
 */
export type Card = FC<CardProps> & {
  Content: FC<{ children: ReactNode }>
  Image: FC<ImageProps>
  Info: FC<{ children: ReactNode }>
  /**
   * Card title with optional `href`.
   */
  Title: FC<TitleProps>
  Footer: FC<{ children: ReactNode }>
  Actions: FC<{ children: ReactNode }>
  Action: FC<ActionButtonProps>
}

const ListCard: Card = ({
  children,
  className,
  forwardClicksToLink = false,
  draggable,
  onClick,
  ...others
}) => {
  let content, imageProps, info, footer, actions
  let title: TitleProps = {}
  const handleHrefClick = useClickChildLink(onClick)
  const handleClick = forwardClicksToLink ? handleHrefClick : onClick

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Content) content = child.props.children
    else if (child.type === Image) imageProps = child.props
    else if (child.type === Info) info = child.props.children
    else if (child.type === Title) title = child.props
    else if (child.type === Footer) footer = child.props.children
    else if (child.type === Actions) actions = child.props.children
  })

  const classNames = ["MitListCard-root", className ?? ""].join(" ")
  if (content) {
    return (
      <BaseContainer {...others} onClick={handleClick} className={classNames}>
        {content}
      </BaseContainer>
    )
  }

  return (
    <BaseContainer
      {...others}
      className={classNames}
      display="flex"
      onClick={handleClick}
    >
      {draggable && (
        <DragArea>
          <RiDraggable />
        </DragArea>
      )}
      <Body>
        <Info>{info}</Info>
        {title && (
          <Title data-card-link={!!title.href} {...title} href={title.href}>
            <TruncateText lineClamp={2}>{title.children}</TruncateText>
          </Title>
        )}
        <Bottom>
          <Footer>{footer}</Footer>
          {actions && <Actions data-card-actions>{actions}</Actions>}
        </Bottom>
      </Body>
      {imageProps && (
        // alt text will be checked on ListCard.Image
        // eslint-disable-next-line styled-components-a11y/alt-text
        <Image {...(imageProps as ImageProps)} />
      )}
    </BaseContainer>
  )
}

ListCard.Content = Content
ListCard.Image = Image
ListCard.Info = Info
ListCard.Title = Title
ListCard.Footer = Footer
ListCard.Actions = Actions
ListCard.Action = ListCardActionButton

export { ListCard }
export { ListCardActionButton }
