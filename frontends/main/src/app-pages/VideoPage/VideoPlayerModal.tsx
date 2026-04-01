import React, { useEffect, useId, useRef } from "react"
import dynamic from "next/dynamic"
import { Typography, styled, theme } from "ol-components"
import { RiCloseLine } from "@remixicon/react"
import type { VideoResource } from "api/v1"
import type { VideoJsPlayerProps } from "./VideoJsPlayer"
import { resolveVideoSources } from "./videoSources"

// Lazy-load the video.js player (and its CSS) only when the modal is opened,
// keeping video.js out of the initial page bundle entirely.
const VideoJsPlayer = dynamic<VideoJsPlayerProps>(
  () => import("./VideoJsPlayer"),
  { ssr: false },
)

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
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  // Save the element that had focus before the modal opened so we can restore
  // it on close, and move focus into the modal immediately.
  useEffect(() => {
    previousFocusRef.current = document.activeElement
    closeButtonRef.current?.focus()

    return () => {
      ;(previousFocusRef.current as HTMLElement | null)?.focus()
    }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  // Trap focus inside the modal: intercept Tab/Shift+Tab and cycle through
  // all keyboard-focusable descendants.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return
    const focusable = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <ModalBackdrop
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <ModalContent
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <ModalHeader>
          <ModalTitle id={titleId}>{video.title}</ModalTitle>
          <ModalCloseButton
            ref={closeButtonRef}
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
