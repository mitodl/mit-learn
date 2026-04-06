import React, { useState } from "react"
import Image from "next/image"
import { Typography, styled, theme, Skeleton } from "ol-components"
import { formatDurationClockTime } from "ol-utilities"
import { RiPlayCircleFill } from "@remixicon/react"
import type { VideoResource } from "api/v1"

const PLACEHOLDER_IMG = "/images/mit-open-learning-logo.svg"

const VideoCardItem = styled.div({
  display: "flex",
  gap: "24px",
  padding: "24px 0",
  alignItems: "flex-start",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  cursor: "pointer",

  "&:hover .play-overlay": {
    opacity: 1,
  },

  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
})

const ThumbnailWrapper = styled.div({
  position: "relative",
  flexShrink: 0,
  width: 200,
  aspectRatio: "16/9",
  overflow: "hidden",
  backgroundColor: theme.custom.colors.black,

  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
})

const ThumbnailImage = styled(Image)({
  objectFit: "cover",
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

const CardTitle = styled(Typography)({
  ...theme.typography.subtitle1,
  fontSize: "20px",
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
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
}))

type VideoCardProps = {
  resource: VideoResource
  onClick: (resource: VideoResource) => void
}

const VideoCard: React.FC<VideoCardProps> = ({ resource, onClick }) => {
  const [imgError, setImgError] = useState(false)
  const imageUrl =
    !imgError && resource.image?.url ? resource.image.url : PLACEHOLDER_IMG
  const description = resource.description ?? ""
  const duration = resource.video?.duration
    ? formatDurationClockTime(resource.video.duration)
    : null

  return (
    <VideoCardItem
      role="button"
      tabIndex={0}
      onClick={() => onClick(resource)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (e.key === " ") {
            e.preventDefault()
          }
          onClick(resource)
        }
      }}
    >
      <ThumbnailWrapper>
        <ThumbnailImage
          src={imageUrl}
          alt={resource.title}
          fill
          sizes="200px"
          onError={() => setImgError(true)}
        />
        {duration && <DurationBadge>{duration}</DurationBadge>}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            opacity: 0,
            transition: "opacity 0.2s",
          }}
          className="play-overlay"
        >
          <RiPlayCircleFill style={{ width: 40, height: 40 }} />
        </div>
      </ThumbnailWrapper>

      <CardContent>
        <CardTitleRow>
          <CardTitle>{resource.title}</CardTitle>
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

// ---------------------------------------------------------------------------
// VideoCardSkeleton component
// ---------------------------------------------------------------------------

const VideoCardSkeleton: React.FC = () => (
  <VideoCardItem>
    <ThumbnailWrapper>
      <Skeleton variant="rectangular" width="100%" height="100%" />
    </ThumbnailWrapper>
    <CardContent>
      <Skeleton variant="text" width="80%" height={24} />
      <Skeleton variant="text" width="50%" height={18} />
      <Skeleton variant="text" width="40%" height={16} />
    </CardContent>
  </VideoCardItem>
)

export { VideoCard, VideoCardSkeleton }
