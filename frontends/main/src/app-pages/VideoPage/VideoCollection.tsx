import React from "react"
import { Typography, styled, theme } from "ol-components"
import VideoContainer from "./VideoContainer"
import type { VideoResource } from "api/v1"
import { VideoCard, VideoCardSkeleton } from "./VideoCard"

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const CollectionSection = styled.div({})

const StyledContainer = styled(VideoContainer)({
  padding: "0 48px !important",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
})

const CollectionHeader = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  margin: "32px 0 8px 0",
})

const CollectionTitle = styled(Typography)({
  ...theme.typography.body1,
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
      <StyledContainer>
        <CollectionHeader>
          <CollectionTitle>{videos.length} Videos</CollectionTitle>
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
      </StyledContainer>
    </CollectionSection>
  )
}

export default VideoCollection
