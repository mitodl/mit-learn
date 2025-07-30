import React, { useEffect, useRef, useState } from "react"
import { styled } from "ol-components"
import { CarouselV2Vertical } from "ol-components/CarouselV2Vertical"
import { RiCloseLine, RiVolumeMuteLine, RiVolumeUpLine } from "@remixicon/react"
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

const CloseButton = styled(ActionButton)({
  position: "absolute",
  top: "16px",
  right: "16px",
  zIndex: 1201,
  svg: {
    fill: "white",
  },
})

const MuteButton = styled(ActionButton)({
  position: "absolute",
  right: "16px",
  bottom: "16px",
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

const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
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
  const [muted, setMuted] = useState(true)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)

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
          videosRef.current[selectedIndex]?.play().catch(() => {})
        }
      }

      event.preventDefault()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, selectedIndex])

  const onSlidesInView = (inView: number[]) => {
    if (inView.length === 1) {
      videosRef.current
        .filter((video, index) => video && index !== inView[0])
        .forEach((video) => {
          video!.pause()
        })
      setSelectedIndex(inView[0])
      if (videosRef.current[inView[0]]) {
        const video = videosRef.current[inView[0]]!
        video.muted = muted

        // On iOS, only autoplay if muted or if user has interacted
        if (!isIOS() || muted || hasUserInteracted) {
          video.play().catch(() => {})
        }
      }
    }
  }

  const onClickMute = () => {
    if (selectedIndex !== null && videosRef.current[selectedIndex]) {
      const video = videosRef.current[selectedIndex]!
      const wasMuted = video.muted
      video.muted = !wasMuted

      setHasUserInteracted(true)

      if (wasMuted && !video.paused) {
        video.play().catch(() => {})
      }
    }
    setMuted(!muted)
  }

  const handleVideoClick = () => {
    if (selectedIndex !== null && videosRef.current[selectedIndex]) {
      const video = videosRef.current[selectedIndex]!
      setHasUserInteracted(true)

      if (video.paused) {
        video.play().catch(() => {})
      } else {
        video.pause()
      }
    }
  }

  return (
    <Overlay>
      <CloseButton size="large" edge="rounded" variant="text" onClick={onClose}>
        <RiCloseLine />
      </CloseButton>
      <MuteButton
        size="large"
        edge="rounded"
        variant="text"
        onClick={onClickMute}
      >
        {muted ? <RiVolumeMuteLine /> : <RiVolumeUpLine />}
      </MuteButton>
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
                    el.addEventListener("error", (e: Event) => {
                      console.error("Video error:", e)
                    })
                  }
                }}
                onClick={handleVideoClick}
                // TODO: Using a temporary bucket on GCP owned by jk
                src={`https://storage.googleapis.com/mit-open-learning/${item.id.videoId}.mp4`}
                autoPlay
                muted
                playsInline
                webkit-playsinline="true"
                controlsList="nofullscreen"
                disablePictureInPicture
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
