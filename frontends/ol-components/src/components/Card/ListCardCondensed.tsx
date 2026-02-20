import React, {
  FC,
  ReactNode,
  Children,
  isValidElement,
  AriaAttributes,
  ReactElement,
} from "react"
import styled from "@emotion/styled"
import { RiDraggable } from "@remixicon/react"
import { theme } from "../ThemeProvider/ThemeProvider"
import { BaseContainer, useClickChildLink } from "./Card"
import {
  ListCard,
  Body as BaseBody,
  DragArea as BaseDragArea,
  Info as BaseInfo,
  Title as BaseTitle,
  Footer,
  LinkableTitle,
} from "./ListCard"
import type { Card as BaseCard, TitleProps } from "./ListCard"

const Container = styled(BaseContainer)<{ draggable?: boolean }>(
  ({ draggable }) => [
    draggable && {
      display: "flex",
      flexDirection: "row",
    },
  ],
)

const DragArea = styled(BaseDragArea)`
  padding-right: 4px;
  margin-right: -4px;
  ${theme.breakpoints.down("md")} {
    margin: 12px -4px 12px 12px;
    padding-right: 4px;
  }
`

const Body = styled(BaseBody)`
  margin: 16px;
  ${theme.breakpoints.down("md")} {
    margin: 16px;
  }
`

const Info = styled(BaseInfo)`
  margin-bottom: 4px;
`

const Title = styled(BaseTitle)`
  height: auto;
  margin-bottom: 8px;
  margin-right: 82px;
  ${theme.breakpoints.down("md")} {
    height: auto;
    ${{ ...theme.typography.subtitle2 }}
  }
`

const Bottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  min-height: 16px;
`
const Actions = styled.div`
  display: flex;
  gap: 16px;
`
const Content = () => <></>

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
 * Condensed row-like card component with slots for info, title, footer, and actions:
 * ```tsx
 * <ListCardCondensed>
 *   <ListCardCondensed.Info>Info</ListCardCondensed.Info>
 *   <ListCardCondensed.Title href="link-url">Title</ListCardCondensed.Title>
 *   <ListCardCondensed.Footer>Footer</ListCardCondensed.Footer>
 *   <ListCardCondensed.Actions>Actions</ListCardCondensed.Actions>
 * </ListCardCondensed>
 * ```
 *
 * **Links:** Card.Title will be a link if `href` is supplied; the entire card
 * will be clickable if `forwardClicksToLink` is `true`.
 *
 * **Custom Layout:** Use ListCard.Content to create a custom layout.
 */
type Card = FC<CardProps> & Omit<BaseCard, "Image">

const ListCardCondensed: Card = ({
  children,
  className,
  draggable,
  onClick,
  forwardClicksToLink = false,
  ...others
}) => {
  let content, info, footer, actions
  let title: TitleProps = {}

  const handleHrefClick = useClickChildLink(onClick)
  const handleClick =
    forwardClicksToLink && !draggable ? handleHrefClick : onClick

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const element = child as ReactElement<{ children?: ReactNode }>
    if (element.type === Content) content = element.props.children
    else if (element.type === Info) info = element.props.children
    else if (element.type === Title) title = element.props as TitleProps
    else if (element.type === Footer) footer = element.props.children
    else if (element.type === Actions) actions = element.props.children
  })

  if (content) {
    return (
      <BaseContainer {...others} onClick={handleClick} className={className}>
        {content}
      </BaseContainer>
    )
  }

  return (
    <Container
      draggable={draggable}
      {...others}
      className={className}
      onClick={handleClick}
    >
      {draggable && (
        <DragArea>
          <RiDraggable />
        </DragArea>
      )}
      <Body>
        <Info>{info}</Info>
        <LinkableTitle title={title} lineClamp={4} />
        <Bottom>
          <Footer>{footer}</Footer>
          {actions && <Actions data-card-actions>{actions}</Actions>}
        </Bottom>
      </Body>
    </Container>
  )
}

ListCardCondensed.Content = Content
ListCardCondensed.Info = Info
ListCardCondensed.Title = Title
ListCardCondensed.Footer = Footer
ListCardCondensed.Actions = Actions
ListCardCondensed.Action = ListCard.Action

export { ListCardCondensed }
