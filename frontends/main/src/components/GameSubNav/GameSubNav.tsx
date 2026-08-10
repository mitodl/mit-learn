"use client"

import React from "react"
// next-nprogress-bar wraps next/navigation's router so navigation drives the
// site's progress bar; it is what the rest of the app uses.
import { useRouter } from "next-nprogress-bar"
import { styled, Typography } from "ol-components"
import type { TypographyProps } from "ol-components"
import { RiArrowLeftSLine } from "@remixicon/react"

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

const BackButton = styled.button({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  boxSizing: "border-box",
  width: "64px",
  height: "32px",
  padding: "0 16px",
  border: "none",
  background: "none",
  cursor: "pointer",
  color: "inherit",
})

/**
 * Mirrors the back button's width so the title stays optically centred in the
 * bar rather than in the space left over beside it.
 */
const BackButtonSpacer = styled.div({
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
 * The bar above a game: a back control, and the game's name centred in it.
 */
const GameSubNav: React.FC<GameSubNavProps> = ({ title }) => {
  const router = useRouter()
  return (
    <Bar>
      <BarInner>
        <BackButton
          type="button"
          aria-label="Go back"
          onClick={() => router.back()}
        >
          <RiArrowLeftSLine size={32} aria-hidden />
        </BackButton>
        <Title variant="h3" component="h1">
          {title}
        </Title>
        <BackButtonSpacer aria-hidden />
      </BarInner>
    </Bar>
  )
}

export default GameSubNav
