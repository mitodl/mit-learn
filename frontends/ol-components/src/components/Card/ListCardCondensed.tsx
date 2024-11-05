import React, {
  FC,
  ReactNode,
  Children,
  isValidElement,
  AriaAttributes,
} from "react"
import styled from "@emotion/styled"
import { RiDraggable } from "@remixicon/react"
import { theme } from "../ThemeProvider/ThemeProvider"
import { BaseContainer, useClickChildLink } from "./Card"
import { TruncateText } from "../TruncateText/TruncateText"
import {
  ListCard,
  Body as BaseBody,
  DragArea as BaseDragArea,
  Info as BaseInfo,
  Title as BaseTitle,
  Footer,
  Bottom as BaseBottom,
} from "./ListCard"
import type { Card as BaseCard, TitleProps } from "./ListCard"

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

const Bottom = styled(BaseBottom)`
  height: auto;
  min-height: 16px;
  ${theme.breakpoints.down("md")} {
    height: auto;
  }
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
  onClick?: () => void
  as?: React.ElementType
} & AriaAttributes

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
  const handleClick = forwardClicksToLink ? handleHrefClick : onClick

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Content) content = child.props.children
    else if (child.type === Info) info = child.props.children
    else if (child.type === Title) title = child.props
    else if (child.type === Footer) footer = child.props.children
    else if (child.type === Actions) actions = child.props.children
  })

  if (content) {
    return (
      <BaseContainer {...others} onClick={handleClick} className={className}>
        {content}
      </BaseContainer>
    )
  }

  return (
    <BaseContainer {...others} className={className} onClick={handleClick}>
      {draggable && (
        <DragArea>
          <RiDraggable />
        </DragArea>
      )}
      <Body>
        <Info>{info}</Info>
        <Title data-card-link={!!title.href} href={title.href}>
          <TruncateText lineClamp={4}>{title.children}</TruncateText>
        </Title>
        <Bottom>
          <Footer>{footer}</Footer>
          {actions && <Actions data-card-actions>{actions}</Actions>}
        </Bottom>
      </Body>
    </BaseContainer>
  )
}

ListCardCondensed.Content = Content
ListCardCondensed.Info = Info
ListCardCondensed.Title = Title
ListCardCondensed.Footer = Footer
ListCardCondensed.Actions = Actions
ListCardCondensed.Action = ListCard.Action

export { ListCardCondensed }
