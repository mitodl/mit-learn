import React from "react"
import { Typography, styled, theme } from "ol-components"
import { RiCloseLine } from "@remixicon/react"
import type { VideoResource } from "api/v1"
import VideoJsPlayer, { resolveVideoSources } from "./VideoJsPlayer"

const ModalBackdrop = styled.div({
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.85)",
  zIndex: 1200,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
})

const ModalContent = styled.div({
  position: "relative",
  width: "100%",
  maxWidth: "900px",
  backgroundColor: "#000",
  borderRadius: "8px",
  overflow: "hidden",
})

const ModalHeader = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  padding: "12px 16px",
  backgroundColor: "#111",
  gap: "12px",
})

const ModalTitle = styled(Typography)({
  color: "#fff",
  fontSize: "15px",
  fontWeight: theme.typography.fontWeightMedium,
  flex: 1,
})

const ModalCloseButton = styled.button({
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "rgba(255,255,255,0.7)",
  padding: 0,
  flexShrink: 0,
  lineHeight: 0,

  "&:hover": { color: "#fff" },

  svg: { width: 22, height: 22 },
})

const PlayerWrapper = styled.div({
  width: "100%",
  aspectRatio: "16/9",
  backgroundColor: "#000",
  position: "relative",

  ".video-js, .vjs-tech": {
    width: "100% !important",
    height: "100% !important",
    position: "absolute",
    top: 0,
    left: 0,
  },
})

type VideoPlayerModalProps = {
  video: VideoResource
  onClose: () => void
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  video,
  onClose,
}) => {
  const sources = resolveVideoSources(video.video?.streaming_url, video.url)

  return (
    <ModalBackdrop
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{video.title}</ModalTitle>
          <ModalCloseButton
            type="button"
            aria-label="Close video"
            onClick={onClose}
          >
            <RiCloseLine />
          </ModalCloseButton>
        </ModalHeader>
        <PlayerWrapper>
          {sources.length > 0 ? (
            <VideoJsPlayer
              sources={sources}
              poster={
                video.video?.cover_image_url ?? video.image?.url ?? undefined
              }
              autoplay
              controls
              fluid={false}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.5)",
                fontSize: 14,
              }}
            >
              No playable source available for this video.
            </div>
          )}
        </PlayerWrapper>
      </ModalContent>
    </ModalBackdrop>
  )
}

export default VideoPlayerModal
