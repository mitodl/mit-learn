import React from "react"
import Image from "next/image"
import { Typography, styled, theme, Skeleton } from "ol-components"
import { formatDurationClockTime } from "ol-utilities"
import { RiPlayCircleFill } from "@remixicon/react"
import type { VideoResource } from "api/v1"

const PLACEHOLDER_IMG = "/images/mit-open-learning-logo.svg"

const VideoCardItem = styled.div({
  display: "flex",
  gap: "20px",
  padding: "20px 0",
  alignItems: "flex-start",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  cursor: "pointer",

  "&:last-child": {
    borderBottom: "none",
  },

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
  borderRadius: "6px",
  overflow: "hidden",
  backgroundColor: theme.custom.colors.black,

  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
})

const ThumbnailImage = styled(Image)({
  objectFit: "cover",
})

const DurationBadge = styled.span({
  position: "absolute",
  bottom: 6,
  right: 6,
  backgroundColor: "rgba(0,0,0,0.75)",
  color: "#fff",
  fontSize: "11px",
  fontWeight: theme.typography.fontWeightMedium,
  padding: "2px 6px",
  borderRadius: "3px",
})

const CardContent = styled.div({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "6px",
})

const CardTitleRow = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
})

const CardTitle = styled(Typography)({
  ...theme.typography.subtitle1,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.black,
})

const CardMetaRow = styled.div({
  display: "flex",
  alignItems: "flex-start",
  gap: "128px",
  flexWrap: "wrap",
  marginTop: "4px",
})

const CardMetaGroup = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "3px",
})

const CardMetaValue = styled(Typography)({
  fontSize: "13px",
  color: theme.custom.colors.darkGray1,
})

// ---------------------------------------------------------------------------
// VideoCard component
// ---------------------------------------------------------------------------

type VideoCardProps = {
  resource: VideoResource
  onClick: (resource: VideoResource) => void
}

const VideoCard: React.FC<VideoCardProps> = ({ resource, onClick }) => {
  const imageUrl = resource.image?.url ?? PLACEHOLDER_IMG
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
        if (e.key === "Enter" || e.key === " ") onClick(resource)
      }}
    >
      <ThumbnailWrapper>
        <ThumbnailImage
          src={imageUrl}
          alt={resource.title}
          fill
          sizes="200px"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = PLACEHOLDER_IMG
          }}
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
