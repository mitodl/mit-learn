import React from "react"
import Image from "next/image"
import Link from "next/link"
import { styled } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import { formatDurationClockTime, useImageWithFallback } from "ol-utilities"
import type { VideoResource } from "api/v1"
import { VIDEO_SHORT_CATEGORY } from "@/common/constants"
import VideoContainer from "./VideoContainer"
import { DurationBadge, PlayIcon, PlayOverlay } from "./shared.styled"

const PLACEHOLDER_IMG = "/images/mit-open-learning-logo.svg"

/** Four vertical cards per row on desktop, three on tablets, two on phones. */
const Grid = styled.ul(({ theme }) => ({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "40px 24px",
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "24px 16px",
  },
}))

const CardLink = styled(Link)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  textDecoration: "none",
  "&:hover .short-title, &:focus-visible .short-title": {
    color: theme.custom.colors.red,
  },
  "&:hover .play-overlay, &:focus-visible .play-overlay": {
    opacity: 1,
  },
}))

const Thumbnail = styled.div(({ theme }) => ({
  position: "relative",
  width: "100%",
  aspectRatio: "9/16",
  overflow: "hidden",
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.black,
}))

const Title = styled.h2(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  transition: "color 0.2s",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.subtitle2,
  },
}))

const ShortCard: React.FC<{ video: VideoResource; href: string }> = ({
  video,
  href,
}) => {
  const {
    src: imageUrl,
    unoptimized,
    onError,
  } = useImageWithFallback(video.image?.url, PLACEHOLDER_IMG)
  const duration = video.video?.duration
    ? formatDurationClockTime(video.video.duration)
    : null
  return (
    <li>
      <CardLink href={href}>
        {/* Hidden from assistive tech: the title names the link, and the
            duration is read after it rather than before. */}
        <Thumbnail aria-hidden>
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(max-width: 600px) 50vw, (max-width: 900px) 33vw, 240px"
            style={{ objectFit: "cover" }}
            unoptimized={unoptimized}
            onError={onError}
          />
          {duration && <DurationBadge $dense>{duration}</DurationBadge>}
          <PlayOverlay className="play-overlay">
            <PlayIcon />
          </PlayOverlay>
        </Thumbnail>
        <Title className="short-title">
          {video.title}
          {duration && <VisuallyHidden> ({duration})</VisuallyHidden>}
        </Title>
      </CardLink>
    </li>
  )
}

type ShortCardsProps = {
  videos: VideoResource[]
  getHref: (video: VideoResource) => string
}

/**
 * Whether these are all vertical shorts (e.g. MIT Pulse), which show as 9:16
 * cards. 16:9 frames would crop their thumbnails to a thin strip.
 */
const isShortsList = (videos: VideoResource[]) =>
  videos.length > 0 &&
  videos.every((video) => video.resource_category === VIDEO_SHORT_CATEGORY)

/** A grid of 9:16 cards, sized to its container. */
const ShortCards: React.FC<ShortCardsProps> = ({ videos, getHref }) => (
  <Grid>
    {videos.map((video) => (
      <ShortCard key={video.id} video={video} href={getHref(video)} />
    ))}
  </Grid>
)

/**
 * A playlist page's videos when they are all shorts. Regular playlists use
 * `FeaturedVideo` and `VideoCollection` instead.
 */
const ShortsGrid: React.FC<ShortCardsProps> = (props) => (
  <section aria-label="Videos">
    <VideoContainer>
      <ShortCards {...props} />
    </VideoContainer>
  </section>
)

export { ShortCards, isShortsList }
export default ShortsGrid
