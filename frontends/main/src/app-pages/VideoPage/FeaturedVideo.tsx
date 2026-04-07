import React, { useState } from "react"
import Image from "next/image"
import { styled } from "ol-components"
import VideoContainer from "./VideoContainer"
import { formatDurationClockTime } from "ol-utilities"
import type { VideoResource } from "api/v1"

const PLACEHOLDER_IMG = "/images/mit-open-learning-logo.svg"

const Section = styled.div(({ theme }) => ({
  padding: "0 0 56px 0",
  [theme.breakpoints.down("sm")]: {
    padding: "0 0 32px 0",
  },
}))

const FeaturedGrid = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "3.95fr 4.6fr",
  columnGap: "40px",
  alignItems: "flex-start",
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}))

const ImageWrapper = styled.div({
  position: "relative",
  width: "100%",
  aspectRatio: "16/9",
  backgroundColor: "#111",
  overflow: "hidden",
  cursor: "pointer",
})

const DurationBadge = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  position: "absolute",
  bottom: 0,
  right: 0,
  backgroundColor: theme.custom.colors.darkGray2,
  color: "#fff",
  fontWeight: theme.typography.fontWeightMedium,
  padding: "8px",
  zIndex: 1,
}))

const TextSide = styled.div(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    padding: "0 0 0 36px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "16px 0 0",
    letteSpacing: "inherit",
  },
}))

const FeaturedTitle = styled.h2(({ theme }) => ({
  ...theme.typography.h1,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
  letterSpacing: "-1.28px",
  lineHeight: "110%",
  margin: "0 0 16px",
  cursor: "pointer",
  fontSize: "64px",
  transition: "color 0.2s",
  "& .mobile-title": {
    display: "none",
  },
  "&:hover": {
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h3,
    fontWeight: theme.typography.fontWeightBold,
    margin: "0 0 16px",
  },
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h4,
    fontSize: "34px",
    fontStyle: "normal",
    lineHeight: "40px",
    letterSpacing: "inherit",
    margin: "0 0 9px",
    "& .desktop-title": {
      display: "none",
    },
    "& .mobile-title": {
      display: "inline",
    },
  },
}))

const FeaturedDescription = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.darkGray1,
  margin: 0,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  lineHeight: "26px",
  [theme.breakpoints.down("sm")]: {
    lineHeight: "26px",
  },
}))

type FeaturedVideoProps = {
  videos: VideoResource[]
  onPlay: (video: VideoResource) => void
}

const FeaturedVideo: React.FC<FeaturedVideoProps> = ({ videos, onPlay }) => {
  const [currentIndex] = useState(0)
  const video = videos[currentIndex]
  if (!video) return null

  const imageUrl = video.image?.url ?? null
  const duration = video.video?.duration
    ? formatDurationClockTime(video.video.duration)
    : null
  const description = video.description ?? ""
  const FEATURED_TITLE_MAX_CHARS = 30
  const truncatedTitle =
    video.title.length > FEATURED_TITLE_MAX_CHARS
      ? `${video.title.slice(0, FEATURED_TITLE_MAX_CHARS).trimEnd()}...`
      : video.title

  return (
    <Section>
      <VideoContainer>
        <FeaturedGrid>
          <ImageWrapper onClick={() => onPlay(video)}>
            <Image
              src={imageUrl ?? PLACEHOLDER_IMG}
              alt={video.title}
              fill
              sizes="(max-width: 600px) 100vw, 50vw"
              style={{ objectFit: "cover" }}
            />
            {duration && <DurationBadge>{duration}</DurationBadge>}
          </ImageWrapper>

          <TextSide>
            <FeaturedTitle onClick={() => onPlay(video)}>
              <span className="desktop-title">{truncatedTitle}</span>
              <span className="mobile-title">{video.title}</span>
            </FeaturedTitle>
            {description && (
              <FeaturedDescription>{description}</FeaturedDescription>
            )}
          </TextSide>
        </FeaturedGrid>
      </VideoContainer>
    </Section>
  )
}

export default FeaturedVideo
