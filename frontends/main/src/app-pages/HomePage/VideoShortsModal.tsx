import React, { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { styled, Typography } from "ol-components"
import { CarouselV2Vertical } from "ol-components/CarouselV2Vertical"
import { RiCloseLine, RiVolumeMuteLine, RiVolumeUpLine } from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
import { useWindowDimensions } from "ol-utilities"
import type { VideoShort } from "api/v0"
import MITOpenLearningLogo from "@/public/images/mit-open-learning-logo.svg"

const NEXT_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_ORIGIN

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

const BaseButton = styled(ActionButton)(({ theme }) => ({
  position: "absolute",
  zIndex: 1201,
  svg: {
    fill: "white",
  },
  [`${theme.breakpoints.down("md")} and (orientation: portrait)`]: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: "50%",
    height: "58px",
    width: "58px",
    right: "26px",
    "&&:hover": {
      backgroundColor: "rgba(40, 40, 40, 0.6)",
    },
  },
}))

const CloseButton = styled(BaseButton)(({ theme }) => ({
  top: "16px",
  right: "16px",
  [`${theme.breakpoints.down("md")} and (orientation: portrait)`]: {
    top: "26px",
    right: "26px",
  },
}))

const MuteButton = styled(BaseButton)(({ theme }) => ({
  right: "16px",
  bottom: "16px",
  [`${theme.breakpoints.down("md")} and (orientation: portrait)`]: {
    bottom: "26px",
    right: "26px",
  },
}))

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

const Video = styled.video(({ height, width, theme }) => ({
  width,
  height,
  backgroundColor: theme.custom.colors.black,
  [theme.breakpoints.down("md")]: {
    width: "100%",
    height: "100%",
  },
}))

const Placeholder = styled.div(({ theme }) => ({
  width: "100%",
  height: "100%",
  backgroundColor: theme.custom.colors.black,
  borderRadius: "12px",
  position: "relative",
  paddingTop: "30vh",

  img: {
    position: "absolute",
    top: "43px",
    left: "50px",
  },

  span: {
    marginLeft: "50px",
    marginRight: "50px",
    color: theme.custom.colors.white,
    fontWeight: theme.typography.fontWeightRegular,
    display: "block",
    marginBottom: "10vh",
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

type VideoWithErrorHandlerProps = {
  index: number
  video: VideoShort
  videosRef: React.MutableRefObject<(HTMLVideoElement | null)[]>
  onError: (index: number, e: Event) => void
  onVideoClick: () => void
  videoWidth: number
  videoHeight: number
}

const VideoWithErrorHandler = ({
  index,
  video,
  videosRef,
  onError,
  onVideoClick,
  videoWidth,
  videoHeight,
}: VideoWithErrorHandlerProps) => {
  const handlerRef = useRef<((e: Event) => void) | null>(null)

  const refCallback = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el) {
        const currentEl = videosRef.current[index]
        if (currentEl && handlerRef.current) {
          currentEl.removeEventListener("error", handlerRef.current)
        }
        videosRef.current[index] = null
        return
      }
      videosRef.current[index] = el

      const handler = (e: Event) => {
        console.error("Video errored", index, e)
        onError(index, e)
      }
      handlerRef.current = handler
      el.addEventListener("error", handler)
    },
    [index, onError, videosRef],
  )

  return (
    <Video
      ref={refCallback}
      onClick={onVideoClick}
      src={`${NEXT_PUBLIC_ORIGIN}${video.video_url}`}
      autoPlay
      muted
      playsInline
      webkit-playsinline="true"
      controlsList="nofullscreen"
      disablePictureInPicture
      width={videoWidth}
      height={videoHeight}
      preload="metadata"
      loop
    />
  )
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(startIndex)
  const [muted, setMuted] = useState(true)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [videoErrors, setVideoErrors] = useState<Record<number, unknown>>({})

  const videosRef = useRef<(HTMLVideoElement | null)[]>([])

  const onVideoError = useCallback((index: number, e: Event) => {
    setVideoErrors((prev) => ({ ...prev, [index]: e }))
  }, [])

  useEffect(() => {
    videosRef.current = videosRef.current.slice(0, videoData.length)
  }, [videoData])

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
        {videoData?.map((video: VideoShort, index: number) => (
          <CarouselSlide
            key={index}
            width={(height - 60) * (9 / 16)}
            data-index={index}
          >
            {selectedIndex !== null && Math.abs(selectedIndex - index) < 2 ? (
              videoErrors[index] ? (
                <Placeholder>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <Image
                    src={MITOpenLearningLogo.src}
                    alt="MIT Open Learning Logo"
                    width={178}
                    height={47}
                    style={{ filter: "brightness(0) invert(1)" }}
                  />
                  <Typography variant="h4">Playback errored!</Typography>
                  <Typography variant="h2">{video.title}</Typography>
                </Placeholder>
              ) : (
                <VideoWithErrorHandler
                  index={index}
                  video={video}
                  videosRef={videosRef}
                  onError={onVideoError}
                  onVideoClick={handleVideoClick}
                  videoWidth={(height - 60) * (9 / 16)}
                  videoHeight={height - 60}
                />
              )
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
