import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { styled, Typography } from "ol-components"
import { CarouselV2Vertical } from "ol-components/CarouselV2Vertical"
import {
  RiCloseLine,
  RiVolumeMuteLine,
  RiVolumeUpLine,
  RiPlayLine,
  RiPauseLine,
} from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
import { useWindowDimensions } from "ol-utilities"
import type { VideoResource } from "api/v1"
import MITOpenLearningLogo from "@/public/images/mit-open-learning-logo.svg"
import VideoJsPlayer from "@/app-pages/VideoPlaylistCollectionPage/VideoJsPlayer"
import type Player from "video.js/dist/types/player"
import { FocusTrap } from "@mui/base/FocusTrap"

const MODAL_VERTICAL_PADDING = 60
const PORTRAIT_ASPECT_RATIO = 9 / 16
const PLAYPAUSE_CLASS = "VideoShorts-playPause"

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

const PlayPauseButton = styled(BaseButton)({
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  opacity: 0,
  transition: "opacity 0.2s ease-out",
  "&:focus-visible": {
    opacity: 1,
    outline: "3px solid white",
    outlineOffset: "4px",
  },
})

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
  "&:focus-visible": {
    outline: "3px solid white",
    outlineOffset: "4px",
  },
  [`&:hover .${PLAYPAUSE_CLASS}`]: {
    opacity: 1,
  },
  [theme.breakpoints.down("md")]: {
    maxWidth: "100%",
    height: "100%",
    margin: "10px 0",
    flex: "0 0 calc(100% - 20px)",
    borderRadius: 0,
  },
}))

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

const playerPaused = (player: Player): boolean => player.paused()
const playerMuted = (player: Player): boolean => player.muted() ?? true


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
        ariaLabel={video.title}
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
  const videoHeight = Math.max(height - MODAL_VERTICAL_PADDING, 0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(startIndex)
  const [muted, setMuted] = useState(true)
  const [playing, setPlaying] = useState(false)
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
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  const onSlidesInView = (inView: number[]) => {
    if (inView.length === 1) {
      playersRef.current
        .filter(
          (player, index): player is Player =>
            player !== null && index !== inView[0],
        )
        .forEach((player) => player.pause())
      setSelectedIndex(inView[0])
      setPlaying(false)
      const player = playersRef.current[inView[0]]
      if (player) {
        player.muted(muted)
        // On iOS, only autoplay if muted or if user has interacted
        if (!isIOS() || muted || hasUserInteracted) {
          player.play()?.catch(() => {
            setPlaying(false)
          })
          setPlaying(true)
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
        player.play()?.catch(() => {
          setPlaying(false)
        })
        setPlaying(true)
      } else {
        player.pause()
        setPlaying(false)
      }
    }
  }

  return (
    <FocusTrap open>
      <Overlay
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Video Shorts"
      >
        <CloseButton
          size="large"
          edge="rounded"
          variant="text"
          onClick={onClose}
          aria-label="Close"
        >
          <RiCloseLine />
        </CloseButton>
        <MuteButton
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          size="large"
          edge="rounded"
          variant="text"
          onClick={onClickMute}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
        >
          {muted ? <RiVolumeMuteLine /> : <RiVolumeUpLine />}
        </MuteButton>
        <CarouselV2Vertical
          initialSlide={startIndex}
          onSlidesInView={onSlidesInView}
        >
          {videoData?.map((video: VideoResource, index: number) => (
            <CarouselSlide
              key={video.id}
              width={videoHeight * PORTRAIT_ASPECT_RATIO}
              height={videoHeight}
              data-index={index}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${videoData.length}: ${video.title}`}
              tabIndex={index === selectedIndex ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVideoClick()
                }
              }}
            >
              {index === selectedIndex ? (
                <PlayPauseButton
                  className={PLAYPAUSE_CLASS}
                  size="large"
                  edge="rounded"
                  variant="text"
                  tabIndex={0}
                  onClick={handleVideoClick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.stopPropagation()
                  }}
                  aria-label={playing ? "Pause" : "Play"}
                  aria-pressed={playing}
                >
                  {playing ? <RiPauseLine /> : <RiPlayLine />}
                </PlayPauseButton>
              ) : null}
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
          ))}
        </CarouselV2Vertical>
      </Overlay>
    </FocusTrap>
  )
}

export default VideoShortsModal
