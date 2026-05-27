import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { styled, Typography } from "ol-components"
import { CarouselV2Vertical } from "ol-components/CarouselV2Vertical"
import { RiCloseLine, RiVolumeMuteLine, RiVolumeUpLine } from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
import { useWindowDimensions } from "ol-utilities"
import type { VideoResource } from "api/v1"
import MITOpenLearningLogo from "@/public/images/mit-open-learning-logo.svg"
import VideoJsPlayer from "@/app-pages/VideoPlaylistCollectionPage/VideoJsPlayer"
import type Player from "video.js/dist/types/player"

const MODAL_VERTICAL_PADDING = 60
const PORTRAIT_ASPECT_RATIO = 9 / 16

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

const CarouselSlide = styled("div", {
  shouldForwardProp: (prop) => prop !== "width" && prop !== "height",
})<{ width: number; height: number }>(({ width, height, theme }) => ({
  width,
  height,
  overflow: "hidden",
  borderRadius: "12px",
  flex: "0 0 auto",
  margin: "30px 0",
  position: "relative",
  [theme.breakpoints.down("md")]: {
    // Don't override width — keep the computed portrait pixel width so
    // CarouselScroll's alignItems: "center" can center it in the overlay.
    // maxWidth: 100% caps it on phones narrower than the portrait width.
    maxWidth: "100%",
    // Restore height behaviour from the original: flex-basis + margin add
    // up to 100% of the carousel height so the slide fills the viewport.
    height: "100%",
    margin: "10px 0",
    flex: "0 0 calc(100% - 20px)",
    borderRadius: 0,
  },
}))

/**
 * Wrapper that fills its parent CarouselSlide completely.
 * CarouselSlide owns the fixed portrait dimensions; CarouselScroll's
 * alignItems: "center" horizontally centers it in the overlay.
 * object-fit: cover on .vjs-tech ensures portrait content fills without
 * letterboxing regardless of the container aspect ratio.
 */
const VideoPlayerContainer = styled("div")(({ theme }) => ({
  width: "100%",
  height: "100%",
  backgroundColor: theme.custom.colors.black,
  cursor: "pointer",
  // Target the actual <video> element rendered by the video.js html5 tech
  "& .vjs-tech": {
    objectFit: "cover",
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

/**
 * Player getter methods in video.js have overloaded signatures (getter + setter),
 * so TypeScript types their return as `T | undefined`. These helpers normalise
 * that to plain booleans/numbers so callers don't need to spread `?? 0` noise.
 */
const playerPaused = (player: Player): boolean => player.paused() !== false
const playerEnded = (player: Player): boolean => player.ended() !== false
const playerCurrentTime = (player: Player): number => player.currentTime() ?? 0
const playerReadyState = (player: Player): number => player.readyState() ?? 0
const playerDuration = (player: Player): number => player.duration() ?? 0
const playerMuted = (player: Player): boolean => player.muted() ?? true

const isPlaying = (player: Player | null): boolean => {
  if (!player) return false
  return (
    !playerPaused(player) &&
    !playerEnded(player) &&
    playerCurrentTime(player) > 0 &&
    playerReadyState(player) >= 2 &&
    playerDuration(player) > 0
  )
}

const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

type VideoWithErrorHandlerProps = {
  index: number
  video: VideoResource
  playersRef: React.RefObject<(Player | null)[]>
  onError: (index: number, e: Event) => void
  onVideoClick: () => void
}

const VideoWithErrorHandler = ({
  index,
  video,
  playersRef,
  onError,
  onVideoClick,
}: VideoWithErrorHandlerProps) => {
  const src = video.video?.streaming_url ?? undefined
  const sourceType = src?.includes(".m3u8")
    ? "application/x-mpegURL"
    : "video/mp4"
  // Memoize so the array reference only changes when `src` actually changes.
  // Without this, every parent re-render (e.g. selectedIndex update) creates a
  // new array, which triggers VideoJsPlayer's sources update effect and calls
  // player.src() — reloading the video and causing a black flash mid-playback.
  const sources = useMemo(
    () => (src ? [{ src, type: sourceType }] : []),
    [src, sourceType],
  )

  useEffect(() => {
    if (!src) {
      onError(index, new Event("missingsource"))
    }
  }, [src, index, onError])

  const handleReady = useCallback(
    (player: Player) => {
      playersRef.current[index] = player
      player.muted(true)

      // Hide the player until the first frame is decoded to avoid a flash of
      // the default video.js background. Reveal as soon as the frame is ready
      // (loadeddata), not when playback starts — this means adjacent
      // pre-initialized slides already show a still frame before the user
      // navigates to them, so there is no black flash during navigation.
      const el = player.el() as HTMLElement
      el.style.opacity = "0"
      player.one("loadeddata", () => {
        el.style.opacity = "1"
      })

      player.on("error", (e: Event) => {
        console.error("Video errored", index, e)
        onError(index, e)
      })
      player.on("dispose", () => {
        playersRef.current[index] = null
      })
    },
    [index, onError, playersRef],
  )

  if (!src) return null

  return (
    <VideoPlayerContainer onClick={onVideoClick}>
      <VideoJsPlayer
        sources={sources}
        autoplay={true}
        controls={false}
        fluid={false}
        loop={true}
        bigPlayButton={false}
        playsinline={true}
        onReady={handleReady}
      />
    </VideoPlayerContainer>
  )
}

type VideoShortsModalProps = {
  startIndex: number
  videoData: VideoResource[]
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

  const playersRef = useRef<(Player | null)[]>([])

  const onVideoError = useCallback((index: number, e: Event) => {
    setVideoErrors((prev) => ({ ...prev, [index]: e }))
  }, [])

  useEffect(() => {
    playersRef.current = playersRef.current.slice(0, videoData.length)
  }, [videoData])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onClose) {
        onClose()
      }

      if (event.key === " " && selectedIndex !== null) {
        const player = playersRef.current[selectedIndex]
        if (player) {
          if (isPlaying(player)) {
            player.pause()
          } else {
            player.play()?.catch(() => {})
          }
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
      playersRef.current
        .filter((player, index): player is Player =>
          player !== null && index !== inView[0],
        )
        .forEach((player) => player.pause())
      setSelectedIndex(inView[0])
      const player = playersRef.current[inView[0]]
      if (player) {
        player.muted(muted)
        // On iOS, only autoplay if muted or if user has interacted
        if (!isIOS() || muted || hasUserInteracted) {
          player.play()?.catch(() => {})
        }
      }
    }
  }

  const onClickMute = () => {
    if (selectedIndex !== null && playersRef.current[selectedIndex]) {
      const player = playersRef.current[selectedIndex]!
      const wasMuted = playerMuted(player)
      player.muted(!wasMuted)

      setHasUserInteracted(true)

      if (wasMuted && !playerPaused(player)) {
        player.play()?.catch(() => {})
      }
    }
    setMuted(!muted)
  }

  const handleVideoClick = () => {
    if (selectedIndex !== null && playersRef.current[selectedIndex]) {
      const player = playersRef.current[selectedIndex]!
      setHasUserInteracted(true)

      if (playerPaused(player)) {
        player.play()?.catch(() => {})
      } else {
        player.pause()
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
        {videoData?.map((video: VideoResource, index: number) => {
          const videoHeight = Math.max(height - MODAL_VERTICAL_PADDING, 0)

          return (
            <CarouselSlide
              key={video.id}
              width={videoHeight * PORTRAIT_ASPECT_RATIO}
              height={videoHeight}
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
                    playersRef={playersRef}
                    onError={onVideoError}
                    onVideoClick={handleVideoClick}
                  />
                )
              ) : (
                <Placeholder />
              )}
            </CarouselSlide>
          )
        })}
      </CarouselV2Vertical>
    </Overlay>
  )
}

export default VideoShortsModal
