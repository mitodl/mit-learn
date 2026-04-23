import React from "react"
import Image from "next/image"
import Link from "next/link"
import { styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import VideoContainer from "./VideoContainer"
import { RiPlayFill } from "@remixicon/react"
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
  alignItems: "center",
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}))

const ImageWrapper = styled(Link, {
  shouldForwardProp: (prop) => prop !== "$isSeries",
})<{ $isSeries?: boolean }>(({ theme, $isSeries }) => ({
  position: "relative",
  width: "100%",
  aspectRatio: "16/9",
  backgroundColor: "#111",
  overflow: "hidden",
  cursor: "pointer",
  display: "block",
  textDecoration: "none",
  "& .play-overlay": {
    opacity: 1,
    transform: "scale(1)",
    transition: "opacity 0.3s ease, transform 0.3s ease",
  },
  "&:hover .play-overlay": {
    opacity: 0.75,
    transform: "scale(1.12)",
  },
  ...($isSeries && {
    [theme.breakpoints.down("sm")]: {
      width: "358px",
      height: "270px",
      aspectRatio: "auto",
      marginBottom: "24px",
    },
  }),
}))

const PlayOverlay = styled.div({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1,
  pointerEvents: "none",
})

const PlayCircle = styled.div({
  width: "92px",
  height: "92px",
  borderRadius: "50%",
  backgroundColor: "rgba(255, 255, 255, 0.50)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
  [theme.breakpoints.down("sm")]: {
    padding: "16px 0 0",
    letterSpacing: "inherit",
  },
}))

const Buttonide = styled.div({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexDirection: "column",
})

const FeaturedTitle = styled.h2(({ theme }) => ({
  ...theme.typography.h1,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
  letterSpacing: "-1.28px",
  lineHeight: "120%",
  margin: "0 0 16px",
  cursor: "pointer",
  fontSize: "48px",
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

const DurationText = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray1,
  marginTop: "16px",
}))

const StyledButton = styled(ButtonLink)(({ theme }) => ({
  width: "220px",
  ...theme.typography.body1,
  padding: "12px 24px 12px 16px",
  lineHeight: "16px",
  height: "48px",
  boxShadow:
    "0 2px 4px 0 rgba(37, 38, 43, 0.10), 0 3px 8px 0 rgba(37, 38, 43, 0.12)",
}))

type FeaturedVideoProps = {
  video: VideoResource
  href: string
  isSeries?: boolean
  totalVideos?: number
  totalTime?: string
}

const FeaturedVideo: React.FC<FeaturedVideoProps> = ({
  video,
  href,
  isSeries = false,
  totalVideos,
  totalTime,
}) => {
  const imageUrl = video.image?.url ?? null
  const duration = video.video?.duration
    ? formatDurationClockTime(video.video.duration)
    : null
  const description = video.description ?? ""

  return (
    <Section>
      <VideoContainer>
        <FeaturedGrid>
          <ImageWrapper
            href={href}
            aria-label={`Play ${video.title}`}
            $isSeries={isSeries}
          >
            <Image
              src={imageUrl ?? PLACEHOLDER_IMG}
              alt={video.title}
              fill
              sizes="(max-width: 600px) 100vw, 50vw"
              style={{ objectFit: isSeries ? "none" : "cover" }}
            />
            <PlayOverlay className="play-overlay">
              <PlayCircle>
                <RiPlayFill size={44} color="#fff" />
              </PlayCircle>
            </PlayOverlay>
            {!isSeries && duration && <DurationBadge>{duration}</DurationBadge>}
            {isSeries && totalVideos && totalTime && (
              <DurationBadge>
                {totalVideos} videos • {totalTime}
              </DurationBadge>
            )}
          </ImageWrapper>

          {!isSeries ? (
            <TextSide>
              <FeaturedTitle>
                <Link
                  href={href}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <span className="desktop-title">{video.title}</span>
                  <span className="mobile-title">{video.title}</span>
                </Link>
              </FeaturedTitle>
              {description && (
                <FeaturedDescription>{description}</FeaturedDescription>
              )}
            </TextSide>
          ) : (
            <>
              <Buttonide>
                <StyledButton
                  href={href}
                  rel="noopener noreferrer"
                  variant="primary"
                  startIcon={<RiPlayFill />}
                >
                  Start watching
                </StyledButton>
                <DurationText>
                  {totalTime} • {totalVideos} videos
                </DurationText>
              </Buttonide>
            </>
          )}
        </FeaturedGrid>
      </VideoContainer>
    </Section>
  )
}

export default FeaturedVideo
