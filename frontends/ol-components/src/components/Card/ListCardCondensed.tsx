import React, { FC, ReactNode, Children, isValidElement } from "react"
import styled from "@emotion/styled"
import { RiDraggable } from "@remixicon/react"
import { theme } from "../ThemeProvider/ThemeProvider"
import { Wrapper, Container, useClickChildHref } from "./Card"
import { TruncateText } from "../TruncateText/TruncateText"
import {
  ListCard,
  Body as BaseBody,
  DragArea as BaseDragArea,
  Info as BaseInfo,
  Title as BaseTitle,
  Footer,
  Actions as BaseActions,
  Bottom as BaseBottom,
} from "./ListCard"
import type { Card as BaseCard } from "./ListCard"

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
const Actions = styled(BaseActions)`
  bottom: 16px;
  right: 16px;
  gap: 16px;
  ${theme.breakpoints.down("md")} {
    bottom: 16px;
    right: 16px;
    gap: 16px;
  }
`
const Content = () => <></>

type CardProps = {
  children: ReactNode[] | ReactNode
  className?: string
  href?: string
  draggable?: boolean
  onClick?: () => void
}

type Card = FC<CardProps> & Omit<BaseCard, "Image">

const ListCardCondensed: Card = ({
  children,
  className,
  href,
  draggable,
  onClick,
}) => {
  let content, info, title, footer, actions

  const hasHref = typeof href === "string"
  const handleHrefClick = useClickChildHref(href, onClick)
  const handleClick = hasHref ? handleHrefClick : onClick

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Content) content = child.props.children
    else if (child.type === Info) info = child.props.children
    else if (child.type === Title) title = child.props.children
    else if (child.type === Footer) footer = child.props.children
    else if (child.type === Actions) actions = child.props.children
  })

  if (content) {
    return (
      <Container onClick={handleClick} className={className}>
        {content}
      </Container>
    )
  }

  return (
    <Wrapper className={className}>
      <Container onClick={handleClick}>
        {draggable && (
          <DragArea>
            <RiDraggable />
          </DragArea>
        )}
        <Body>
          <Info>{info}</Info>
          <Title href={href}>
            <TruncateText lineClamp={4}>{title}</TruncateText>
          </Title>
          <Bottom>
            <Footer>{footer}</Footer>
          </Bottom>
        </Body>
      </Container>
      {actions && <Actions>{actions}</Actions>}
    </Wrapper>
  )
}

ListCardCondensed.Content = Content
ListCardCondensed.Info = Info
ListCardCondensed.Title = Title
ListCardCondensed.Footer = Footer
ListCardCondensed.Actions = Actions
ListCardCondensed.Action = ListCard.Action

export { ListCardCondensed }
