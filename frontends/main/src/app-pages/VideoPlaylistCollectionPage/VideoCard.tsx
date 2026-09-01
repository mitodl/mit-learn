import React, { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Typography, styled, theme, Skeleton } from "ol-components"
import { formatDurationClockTime } from "ol-utilities"
import { stripAnchorTags } from "@/common/utils"
import type { VideoResource } from "api/v1"
import {
  DurationBadge,
  PlayOverlay,
  PlayIcon,
  ThumbnailWrapper,
} from "./shared.styled"

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
    opacity: 0.5,
  },

  "&:focus-visible .play-overlay": {
    opacity: 0.5,
  },

  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    padding: "24px 0 24px 0",
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
  /* Clamped preview: description markup is flattened so a list cannot blow the
     box out. Anchors are stripped in the component (the row is itself a link). */
  "p, ul, ol, li": { display: "inline", margin: 0, padding: 0, listStyle: "none" },
  "p + p::before, li + li::before": { content: '" "' },
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
  const imageUrl = !imgError
    ? (resource?.image?.url ?? PLACEHOLDER_IMG)
    : PLACEHOLDER_IMG
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
            {/* The whole card is a link, so anchors from the description
                have to go - a nested <a> splits the card's own link. */}
            <CardMetaValue
              dangerouslySetInnerHTML={{ __html: stripAnchorTags(description) }}
            />
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
