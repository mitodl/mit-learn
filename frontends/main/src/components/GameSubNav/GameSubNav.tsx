"use client"

import React from "react"
import Link from "next/link"
import { styled, Typography } from "ol-components"
import type { TypographyProps } from "ol-components"
import { RiArrowLeftSLine } from "@remixicon/react"
import * as urls from "@/common/urls"

const Bar = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px 200px",
  backgroundColor: theme.custom.colors.white,
  boxShadow: "2px 2px 15px 0 rgba(0, 0, 0, 0.05)",
  [theme.breakpoints.down("lg")]: {
    padding: "16px 32px",
  },
  [theme.breakpoints.down("md")]: {
    padding: "12px 16px",
  },
}))

const BarInner = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  maxWidth: "1272px",
})

const BackLink = styled(Link)({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  boxSizing: "border-box",
  width: "64px",
  height: "32px",
  padding: "0 16px",
  color: "inherit",
})

/**
 * Mirrors the back link's width so the title stays optically centred in the
 * bar rather than in the space left over beside it.
 */
const BackLinkSpacer = styled.div({
  flexShrink: 0,
  width: "64px",
  height: "32px",
})

const Title = styled(Typography)<Pick<TypographyProps, "component">>(
  ({ theme }) => ({
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    color: theme.custom.colors.black,
  }),
)

type GameSubNavProps = {
  /** The game's name, shown centred in the bar. */
  title: string
}

/**
 * The bar above a game: a link out of it, and the game's name centred in it.
 *
 * The link goes to a fixed destination rather than popping history, so that it
 * still leads somewhere sensible when the game is opened directly by URL.
 */
const GameSubNav: React.FC<GameSubNavProps> = ({ title }) => {
  return (
    <Bar>
      <BarInner>
        <BackLink href={urls.HOME} aria-label="Back to home">
          <RiArrowLeftSLine size={32} aria-hidden />
        </BackLink>
        <Title variant="h3" component="h1">
          {title}
        </Title>
        <BackLinkSpacer aria-hidden />
      </BarInner>
    </Bar>
  )
}

export default GameSubNav
