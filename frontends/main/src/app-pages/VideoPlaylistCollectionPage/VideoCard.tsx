import React, { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Typography, styled, theme, Skeleton } from "ol-components"
import { formatDurationClockTime } from "ol-utilities"
import { RiPlayCircleFill } from "@remixicon/react"
import type { VideoResource } from "api/v1"

const PLACEHOLDER_IMG = "/images/mit-open-learning-logo.svg"

const VideoCardItem = styled(Link)({
  display: "flex",
  gap: "24px",
  padding: "24px 0 23px 0",
  alignItems: "flex-start",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  cursor: "pointer",
  textDecoration: "none",

  "&:hover .video-card-title, &:focus-visible .video-card-title": {
    color: theme.custom.colors.red,
  },

  "&:hover .play-overlay": {
    opacity: 1,
  },

  "&:focus-visible .play-overlay": {
    opacity: 1,
  },

  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    padding: "24px 0 24px 0",
  },
})

const ThumbnailWrapper = styled.div({
  position: "relative",
  flexShrink: 0,
  width: 160,
  aspectRatio: "16/9",
  overflow: "hidden",
  backgroundColor: theme.custom.colors.black,

  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
})

const ThumbnailImage = styled(Image)(({ theme }) => ({
  objectFit: "cover",
  width: "160px",
  height: "90px",
  [theme.breakpoints.down("sm")]: {
    height: "201.375px",
  },
}))

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

const PlayOverlay = styled.div({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  opacity: 0,
  transition: "opacity 0.2s",
  backgroundColor: "rgba(0, 0, 0, 0.18)",
})

const CardContent = styled.div({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const CardTitleRow = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
})

const CardTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontSize: "20px",
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
  lineHeight: "26px" /* 130% */,
  marginTop: "6px",
  [theme.breakpoints.down("sm")]: {
    marginTop: 0,
  },
}))

const PlayIcon = styled(RiPlayCircleFill)({
  width: 48,
  height: 48,
})

const CardMetaRow = styled.div({
  display: "flex",
  alignItems: "flex-start",
  gap: "128px",
  flexWrap: "wrap",
})

const CardMetaGroup = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "3px",
})

const CardMetaValue = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  lineHeight: "22px",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
}))

type VideoCardProps = {
  resource: VideoResource
  href: string
}

const VideoCard: React.FC<VideoCardProps> = ({ resource, href }) => {
  const [imgError, setImgError] = useState(false)
  const imageUrl =
    !imgError && resource.image?.url ? resource.image.url : PLACEHOLDER_IMG
  const description = resource.description ?? ""
  const duration = resource.video?.duration
    ? formatDurationClockTime(resource.video.duration)
    : null

  return (
    <VideoCardItem href={href}>
      <ThumbnailWrapper>
        <ThumbnailImage
          src={imageUrl}
          alt={resource.title}
          fill
          sizes="160px"
          onError={() => setImgError(true)}
        />
        {duration && <DurationBadge>{duration}</DurationBadge>}
        <PlayOverlay className="play-overlay">
          <PlayIcon />
        </PlayOverlay>
      </ThumbnailWrapper>

      <CardContent>
        <CardTitleRow>
          <CardTitle className="video-card-title">{resource.title}</CardTitle>
        </CardTitleRow>
        <CardMetaRow>
          <CardMetaGroup>
            <CardMetaValue>{description}</CardMetaValue>
          </CardMetaGroup>
        </CardMetaRow>
      </CardContent>
    </VideoCardItem>
  )
}

const VideoCardSkeletonItem = styled.div({
  display: "flex",
  gap: "24px",
  padding: "24px 0 23px 0",
  alignItems: "flex-start",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    padding: "24px 0 24px 0",
  },
})

const VideoCardSkeleton: React.FC = () => (
  <VideoCardSkeletonItem>
    <ThumbnailWrapper>
      <Skeleton variant="rectangular" width="100%" height="100%" />
    </ThumbnailWrapper>
    <CardContent>
      <Skeleton variant="text" width="80%" height={24} />
      <Skeleton variant="text" width="50%" height={18} />
      <Skeleton variant="text" width="40%" height={16} />
    </CardContent>
  </VideoCardSkeletonItem>
)

export { VideoCard, VideoCardSkeleton }
