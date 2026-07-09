import React from "react"
import { Typography, styled } from "ol-components"
import PodcastContainer from "../PodcastContainer"
import { formatApproxCount } from "./helpers"

const HeroSectionWrap = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  padding: "96px 0",
  textAlign: "center",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0 40px 0",
    textAlign: "left",
    justifyContent: "flex-start",
  },
}))

const HeroHeading = styled("h1")(({ theme }) => ({
  ...theme.typography.h1,
  fontSize: "64px",
  lineHeight: 1.2,
  letterSpacing: "-1.28px",
  display: "block",
  color: theme.custom.colors.black,
  marginBottom: "24px",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h2,
    marginBottom: "8px",
    letterSpacing: "normal",
  },
}))

const HeroDescription = styled(Typography)(({ theme }) => ({
  fontSize: "24px",
  lineHeight: 1.4,
  color: theme.custom.colors.darkGray1,
  marginBottom: "24px",
  [theme.breakpoints.down("sm")]: {
    fontSize: "16px",
    lineHeight: "26px",
    marginBottom: "8px",
  },
}))

const HeroStats = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  lineHeight: "22px",
  color: theme.custom.colors.silverGrayDark,
}))

export type HeroSectionProps = {
  totalPodcasts: number
  totalEpisodes: number
}

const HeroSection: React.FC<HeroSectionProps> = ({
  totalPodcasts,
  totalEpisodes,
}) => {
  return (
    <HeroSectionWrap>
      <PodcastContainer>
        <HeroHeading>Podcasts from across MIT</HeroHeading>
        <HeroDescription variant="body1">
          New podcast episodes and podcasts.
        </HeroDescription>
        <HeroStats variant="body3">
          {`${formatApproxCount(totalPodcasts)} podcasts  •  ${formatApproxCount(totalEpisodes)} episodes  •  Updated daily`}
        </HeroStats>
      </PodcastContainer>
    </HeroSectionWrap>
  )
}

export default HeroSection
