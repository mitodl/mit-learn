import React, {
  FC,
  ReactNode,
  Children,
  isValidElement,
  ReactElement,
} from "react"
import type { AriaRole, AriaAttributes } from "react"
import styled from "@emotion/styled"
import { RiDraggable } from "@remixicon/react"
import { theme } from "../ThemeProvider/ThemeProvider"
import { BaseContainer, ImageProps, useClickChildLink, Linkable } from "./Card"
import { TruncateText } from "../TruncateText/TruncateText"
import { ActionButton } from "@mitodl/smoot-design"
import type { ActionButtonProps } from "@mitodl/smoot-design"
import { default as NextImage } from "next/image"

const Content = () => <></>

export const Body = styled.div`
  flex-grow: 1;
  margin: 24px;
  ${theme.breakpoints.down("md")} {
    margin: 12px;
    min-width: 190px;
  }

  display: flex;
  flex-direction: column;
  justify-content: space-between;
`

export const DragArea = styled.div`
  margin: 16px -6px 16px 16px;
  padding-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid ${theme.custom.colors.lightGray2};

  ${theme.breakpoints.down("md")} {
    margin: 12px 0 12px 12px;
    padding-right: 4px;
  }

  svg {
    fill: ${theme.custom.colors.silverGrayDark};
    width: 24px;
    height: 24px;
    ${theme.breakpoints.down("md")} {
      width: 20px;
      height: 20px;
    }
  }
`

const Image = styled(NextImage)`
  display: block;
  width: 236px;
  height: 122px;
  margin: 24px 24px 24px 0;
  border-radius: 4px;
  object-fit: cover;
  ${theme.breakpoints.down("md")} {
    width: 111px;
    height: 106px;
    margin: 0;
    border-radius: 0;
  }

  background-color: ${theme.custom.colors.lightGray1};
  flex-shrink: 0;
`

export const Info = styled.div`
  ${{ ...theme.typography.subtitle3 }}
  margin-bottom: 16px;
  ${theme.breakpoints.down("md")} {
    ${{ ...theme.typography.subtitle4 }}
    margin-bottom: 8px;
  }

  color: ${theme.custom.colors.silverGrayDark};
  display: flex;
  justify-content: space-between;
  align-items: center;
`

export type TitleProps = {
  children?: ReactNode
  href?: string
  lang?: string
  role?: AriaRole
} & AriaAttributes

export const Title: React.FC<TitleProps> = styled(Linkable)`
  flex-grow: 1;
  color: ${theme.custom.colors.darkGray2};
  text-overflow: ellipsis;
  ${{ ...theme.typography.subtitle1 }}
  height: ${theme.typography.pxToRem(40)};
  margin: 0;
  ${theme.breakpoints.down("md")} {
    ${{ ...theme.typography.subtitle3 }}
    height: ${theme.typography.pxToRem(32)};
  }
`

export const LinkableTitle = ({
  title,
  lineClamp = 2,
}: {
  title: TitleProps
  lineClamp?: number
}) => {
  const { href, role, "aria-level": ariaLevel, lang, children, ...rest } = title

  return (
    <Title data-card-link={!!href} href={href} {...rest}>
      <span role={role} aria-level={ariaLevel}>
        <TruncateText lineClamp={lineClamp} lang={lang}>
          {children}
        </TruncateText>
      </span>
    </Title>
  )
}

export const Footer = styled.span`
  display: block;
  ${{ ...theme.typography.body3 }}
  color: ${theme.custom.colors.darkGray2};
  white-space: nowrap;
`

export const Bottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: ${theme.typography.pxToRem(32)};
  margin-top: 2px;
  ${theme.breakpoints.down("md")} {
    height: ${theme.typography.pxToRem(16)};
    margin-top: 8px;
    align-items: center;
  }
`

/**
 * Slot intended to contain ListCardAction buttons.
 */
export const Actions = styled.div`
  display: flex;
  gap: 8px;
  ${theme.breakpoints.down("md")} {
    gap: 4px;
  }
`

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
  onClick?: React.MouseEventHandler<HTMLElement>
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
  let content,
    imageProps,
    info,
    footer,
    actions,
    title: TitleProps = {}
  const handleHrefClick = useClickChildLink(onClick)
  const handleClick = forwardClicksToLink ? handleHrefClick : onClick

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const element = child as ReactElement<{ children?: ReactNode }>
    if (element.type === Content) content = element.props.children
    else if (element.type === Image) imageProps = element.props as ImageProps
    else if (element.type === Info) info = element.props.children
    else if (element.type === Title) title = element.props as TitleProps
    else if (element.type === Footer) footer = element.props.children
    else if (element.type === Actions) actions = element.props.children
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
        {title && <LinkableTitle title={title} />}
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
