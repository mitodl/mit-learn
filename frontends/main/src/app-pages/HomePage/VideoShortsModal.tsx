import React, { useEffect, useRef, useState, useCallback } from "react"
import { styled, CarouselV2Vertical } from "ol-components"
import { RiCloseLine } from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
import { useWindowDimensions } from "ol-utilities"
import type { VideoShort } from "api/hooks/videoShorts"

const Overlay = styled.div(({ theme }) => ({
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0, 0.9)",
  zIndex: 1200,
  [theme.breakpoints.down("md")]: {
    backgroundColor: theme.custom.colors.black,
  },
}))

const CloseContainer = styled.div({
  position: "absolute",
  top: "16px",
  right: "16px",
  zIndex: 1201,
  svg: {
    fill: "white",
  },
})

const CarouselSlide = styled.div<{ width: number }>(({ width, theme }) => ({
  width,
  overflow: "hidden",
  borderRadius: "12px",
  flex: "0 0 calc(100% - 60px)",
  margin: "30px 0",
  position: "relative",
  [theme.breakpoints.down("md")]: {
    width: "100%",
    margin: "10px 0",
    flex: "0 0 calc(100% - 20px)",
    borderRadius: 0,
  },
}))

const Placeholder = styled.div(({ theme }) => ({
  width: "100%",
  height: "100%",
  backgroundColor: "black",
  borderRadius: "12px",
  [theme.breakpoints.down("md")]: {
    borderRadius: 0,
  },
}))

const StyledActionButton = styled(ActionButton)(({ disabled }) => ({
  opacity: disabled ? 0.5 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
}))

const Video = styled.video(({ height, width, theme }) => ({
  width,
  height,
  [theme.breakpoints.down("md")]: {
    width: "100%",
    height: "100%",
  },
}))

const isPlaying = (videoElement: HTMLVideoElement | null): boolean => {
  if (!videoElement) return false

  const isPlaying =
    !videoElement.paused && !videoElement.ended && videoElement.currentTime > 0

  const isReady = videoElement.readyState >= 2

  const hasDuration = videoElement.duration > 0

  return isPlaying && isReady && hasDuration
}

type VideoShortsModalProps = {
  startIndex: number
  videoData: VideoShort[]
  onClose: () => void
}
const VideoShortsModal = ({
  startIndex = 0,
  videoData,
  onClose,
}: VideoShortsModalProps) => {
  const { height } = useWindowDimensions()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const videosRef = useRef<(HTMLVideoElement | null)[]>([])

  useEffect(() => {
    videosRef.current = videosRef.current.slice(0, videoData.length)
  }, [videoData])

  useEffect(() => {
    setSelectedIndex(startIndex)
  }, [startIndex])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onClose) {
        onClose()
      }

      if (event.key === "Space" && selectedIndex !== null) {
        if (isPlaying(videosRef.current[selectedIndex])) {
          videosRef.current[selectedIndex]?.pause()
        } else {
          videosRef.current[selectedIndex]?.play()
        }
      }

      event.preventDefault()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, selectedIndex])

  const onSlidesInView = useCallback((inView: number[]) => {
    if (inView.length === 1) {
      videosRef.current
        .filter((video, index) => video && index !== inView[0])
        .forEach((video) => {
          video!.pause()
        })
      setSelectedIndex(inView[0])
      if (videosRef.current[inView[0]]) {
        videosRef.current[inView[0]]?.play()
      }
    }
  }, [])

  return (
    <Overlay>
      <CloseContainer>
        <StyledActionButton
          size="large"
          edge="rounded"
          variant="text"
          onClick={onClose}
        >
          <RiCloseLine aria-hidden />
        </StyledActionButton>
      </CloseContainer>
      <CarouselV2Vertical
        initialSlide={startIndex}
        onSlidesInView={onSlidesInView}
      >
        {videoData?.map((item: VideoShort, index: number) => (
          <CarouselSlide
            key={index}
            width={(height - 60) * (9 / 16)}
            data-index={index}
          >
            {selectedIndex !== null && Math.abs(selectedIndex - index) < 2 ? (
              <Video
                ref={(el) => {
                  if (videosRef.current && el) {
                    videosRef.current[index] = el
                  }
                }}
                // TODO: Using a temporary bucket on GCP owned by jk
                src={`https://storage.googleapis.com/mit-open-learning/${item.id.videoId}.mp4`}
                controls
                width={(height - 60) * (9 / 16)}
                height={height - 60}
                preload="metadata"
                loop
              />
            ) : (
              <Placeholder />
            )}
          </CarouselSlide>
        ))}
      </CarouselV2Vertical>
    </Overlay>
  )
}

export default VideoShortsModal
