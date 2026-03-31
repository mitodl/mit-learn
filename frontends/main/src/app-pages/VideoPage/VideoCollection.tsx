import React from "react"
import { Container, Typography, styled, theme } from "ol-components"
import type { VideoResource } from "api/v1"
import { VideoCard, VideoCardSkeleton } from "./VideoCard"

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const CollectionSection = styled.div({
  padding: "32px 0 64px",
})

const CollectionHeader = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
})

const CollectionTitle = styled(Typography)({
  ...theme.typography.h5,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.custom.colors.black,
})

const VideoCardList = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "0",
})

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type VideoCollectionProps = {
  videos: VideoResource[]
  isLoading: boolean
  onPlay: (video: VideoResource) => void
}

const VideoCollection: React.FC<VideoCollectionProps> = ({
  videos,
  isLoading,
  onPlay,
}) => {
  return (
    <CollectionSection>
      <Container>
        <CollectionHeader>
          <CollectionTitle>Collection Browser</CollectionTitle>
        </CollectionHeader>

        <VideoCardList>
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))
            : videos.map((resource) => (
                <VideoCard
                  key={resource.id}
                  resource={resource}
                  onClick={onPlay}
                />
              ))}
        </VideoCardList>
      </Container>
    </CollectionSection>
  )
}

export default VideoCollection
