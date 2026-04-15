"use client"

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from "react"
import { styled, Typography, LoadingSpinner } from "ol-components"
import {
  RiPlayCircleFill,
  RiPauseCircleFill,
  RiPlayCircleLine,
  RiPauseCircleLine,
  RiReplay10Line,
  RiForward30Line,
  RiCloseLine,
} from "@remixicon/react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type PodcastTrack = {
  audioUrl: string
  title: string
  podcastName: string
}

export type PodcastPlayerHandle = {
  togglePlayPause: () => Promise<void>
}

type PodcastPlayerProps = {
  track: PodcastTrack
  onClose: () => void
  onPlayStateChange?: (isPlaying: boolean) => void
}

// ─── Styled components ────────────────────────────────────────────────────────

const PlayerBar = styled.div(({ theme }) => ({
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: theme.zIndex.appBar + 10,
  display: "flex",
  alignItems: "center",
  gap: "24px",
  padding: "16px 32px",
  background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
  borderTop: `2px solid ${theme.custom.colors.mitRed}`,
  boxShadow: "0 -4px 16px rgba(0,0,0,0.12)",
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

// ─── Mobile card styles ───────────────────────────────────────────────────────

const MobileCard = styled.div(({ theme }) => ({
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: theme.zIndex.appBar + 10,
  display: "none",
  flexDirection: "column",
  gap: "16px",
  padding: "24px",
  background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
  borderTop: `2px solid ${theme.custom.colors.mitRed}`,
  borderRadius: "12px 12px 0 0",
  boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
  [theme.breakpoints.down("sm")]: {
    display: "flex",
  },
}))

const MobileTopRow = styled.div({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
})

const MobileTitleArea = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  flex: 1,
  minWidth: 0,
})

const MobileControls = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "32px",
})

const MobileSkipButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "8px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "2px",
  color: theme.custom.colors.silverGray,
  "&:hover": { color: theme.custom.colors.mitRed },
}))

const MobilePlayPauseButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  alignItems: "center",
  color: theme.custom.colors.mitRed,
  "&:hover": { opacity: 0.8 },
}))

const MobileProgressRow = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "8px",
})

const TrackInfo = styled.div({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  width: 220,
  flexShrink: 0,
})

const Divider = styled.div(({ theme }) => ({
  width: "1px",
  height: "40px",
  backgroundColor: theme.custom.colors.lightGray2,
  flexShrink: 0,
}))

const Controls = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexShrink: 0,
})

const IconButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  alignItems: "center",
  color: theme.custom.colors.silverGray,
  "&:hover": { color: theme.custom.colors.mitRed },
}))

const PlayPauseButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  alignItems: "center",
  color: theme.custom.colors.mitRed,
  "&:hover": { opacity: 0.8 },
}))

const TimeLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
  flexShrink: 0,
  minWidth: "38px",
  textAlign: "center",
}))

const TrackTitle = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
}))

const ProgressWrapper = styled.div({
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minWidth: 0,
})

const ProgressTrack = styled.div(({ theme }) => ({
  flex: 1,
  height: "6px",
  borderRadius: "3px",
  backgroundColor: theme.custom.colors.lightGray2,
  position: "relative",
  cursor: "pointer",
  "&:hover .thumb": { opacity: 1 },
}))

const ProgressFill = styled.div<{ percent: number }>(({ theme, percent }) => ({
  height: "100%",
  borderRadius: "3px",
  width: `${percent}%`,
  backgroundColor: theme.custom.colors.mitRed,
  position: "relative",
}))

const SpeedButton = styled.button(({ theme }) => ({
  background: "white",
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  backgroundColor: theme.custom.colors.lightGray1,
  borderRadius: "4px",
  padding: "2px 8px",
  cursor: "pointer",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  flexShrink: 0,
  "&:hover": {
    borderColor: theme.custom.colors.mitRed,
    color: theme.custom.colors.mitRed,
  },
}))

const CloseButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  alignItems: "center",
  color: theme.custom.colors.darkGray2,
  marginLeft: "auto",
  flexShrink: 0,
  "&:hover": { color: theme.custom.colors.mitRed },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2]

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// ─── Component ────────────────────────────────────────────────────────────────

const PodcastPlayer = forwardRef<PodcastPlayerHandle, PodcastPlayerProps>(
  ({ track, onClose, onPlayStateChange }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isBuffering, setIsBuffering] = useState(true)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [speedIndex, setSpeedIndex] = useState(1) // default 1x
    const speedIndexRef = useRef(1)

    // Auto-play when a new track is loaded
    useEffect(() => {
      setCurrentTime(0)
      setIsPlaying(false)
      setIsBuffering(true)
      const audio = audioRef.current
      if (!audio) return
      audio.load()
      audio.playbackRate = SPEED_OPTIONS[speedIndexRef.current]
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {})
    }, [track.audioUrl])

    const handlePlayPause = async () => {
      const audio = audioRef.current
      if (!audio) return
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        try {
          await audio.play()
          setIsPlaying(true)
        } catch {
          setIsPlaying(false)
        }
      }
    }

    useImperativeHandle(ref, () => ({
      togglePlayPause: handlePlayPause,
    }))

    useEffect(() => {
      onPlayStateChange?.(isPlaying)
    }, [isPlaying, onPlayStateChange])

    const handleSkip = (seconds: number) => {
      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = Math.max(
        0,
        Math.min(audio.currentTime + seconds, duration),
      )
    }

    const handleSpeedCycle = () => {
      const nextIndex = (speedIndex + 1) % SPEED_OPTIONS.length
      speedIndexRef.current = nextIndex
      setSpeedIndex(nextIndex)
      if (audioRef.current) {
        audioRef.current.playbackRate = SPEED_OPTIONS[nextIndex]
      }
    }

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current
      if (!audio || !duration) return
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      audio.currentTime = ratio * duration
    }

    const percent = duration ? (currentTime / duration) * 100 : 0
    return (
      <>
        {/* Shared audio element */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          ref={audioRef}
          src={track.audioUrl}
          onWaiting={() => setIsBuffering(true)}
          onCanPlay={() => setIsBuffering(false)}
          onError={() => {
            setIsBuffering(false)
            setIsPlaying(false)
          }}
          onTimeUpdate={() =>
            setCurrentTime(audioRef.current?.currentTime ?? 0)
          }
          onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
          onEnded={() => setIsPlaying(false)}
        />

        {/* ── Desktop player bar (hidden on mobile) ── */}
        <PlayerBar>
          {/* Track info */}
          <TrackInfo>
            <Typography variant="body3" sx={{ color: "text.secondary" }}>
              {track.podcastName}
            </Typography>
            <TrackTitle
              variant="subtitle2"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {track.title}
            </TrackTitle>
          </TrackInfo>

          <Divider />

          {/* Controls */}
          <Controls>
            <IconButton
              onClick={() => handleSkip(-10)}
              aria-label="Rewind 10 seconds"
              title="Rewind 10s"
            >
              <RiReplay10Line size={24} />
            </IconButton>

            <PlayPauseButton
              onClick={handlePlayPause}
              aria-label={
                isBuffering ? "Loading" : isPlaying ? "Pause" : "Play"
              }
              disabled={isBuffering}
            >
              {isBuffering ? (
                <LoadingSpinner loading size={40} color="inherit" />
              ) : isPlaying ? (
                <RiPauseCircleLine size={40} />
              ) : (
                <RiPlayCircleLine size={40} />
              )}
            </PlayPauseButton>

            <IconButton
              onClick={() => handleSkip(30)}
              aria-label="Forward 30 seconds"
              title="Forward 30s"
            >
              <RiForward30Line size={24} />
            </IconButton>
          </Controls>

          {/* Progress */}
          <ProgressWrapper>
            <TimeLabel variant="body3">{formatTime(currentTime)}</TimeLabel>
            <ProgressTrack
              onClick={handleProgressClick}
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault()
                  handleSkip(-5)
                } else if (event.key === "ArrowRight") {
                  event.preventDefault()
                  handleSkip(5)
                } else if (
                  event.key === "ArrowUp" ||
                  event.key === "ArrowDown"
                ) {
                  event.preventDefault()
                }
              }}
            >
              <ProgressFill percent={percent} />
            </ProgressTrack>
            <TimeLabel variant="body3">{formatTime(duration)}</TimeLabel>
          </ProgressWrapper>

          {/* Speed */}
          <SpeedButton onClick={handleSpeedCycle} aria-label="Playback speed">
            {SPEED_OPTIONS[speedIndex]}x
          </SpeedButton>

          {/* Close */}
          <CloseButton onClick={onClose} aria-label="Close player">
            <RiCloseLine size={24} />
          </CloseButton>
        </PlayerBar>

        {/* ── Mobile bottom-sheet card (hidden on desktop) ── */}
        <MobileCard>
          {/* Top row: title info + close */}
          <MobileTopRow>
            <MobileTitleArea>
              <Typography variant="body3" sx={{ color: "text.secondary" }}>
                {track.podcastName}
              </Typography>
              <TrackTitle
                variant="subtitle2"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {track.title}
              </TrackTitle>
            </MobileTitleArea>
            <CloseButton onClick={onClose} aria-label="Close player">
              <RiCloseLine size={24} />
            </CloseButton>
          </MobileTopRow>

          {/* Controls: skip back | play/pause | skip forward */}
          <MobileControls>
            <MobileSkipButton
              onClick={() => handleSkip(-10)}
              aria-label="Rewind 10 seconds"
            >
              <RiReplay10Line size={32} />
            </MobileSkipButton>

            <MobilePlayPauseButton
              onClick={handlePlayPause}
              aria-label={
                isBuffering ? "Loading" : isPlaying ? "Pause" : "Play"
              }
              disabled={isBuffering}
            >
              {isBuffering ? (
                <LoadingSpinner loading size={56} color="inherit" />
              ) : isPlaying ? (
                <RiPauseCircleFill size={56} />
              ) : (
                <RiPlayCircleFill size={56} />
              )}
            </MobilePlayPauseButton>

            <MobileSkipButton
              onClick={() => handleSkip(30)}
              aria-label="Forward 30 seconds"
            >
              <RiForward30Line size={32} />
            </MobileSkipButton>
          </MobileControls>

          {/* Progress row: time | track | time | speed */}
          <MobileProgressRow>
            <TimeLabel variant="body3">{formatTime(currentTime)}</TimeLabel>
            <ProgressTrack
              onClick={handleProgressClick}
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault()
                  handleSkip(-5)
                } else if (event.key === "ArrowRight") {
                  event.preventDefault()
                  handleSkip(5)
                } else if (
                  event.key === "ArrowUp" ||
                  event.key === "ArrowDown"
                ) {
                  event.preventDefault()
                }
              }}
              style={{ flex: 1 }}
            >
              <ProgressFill percent={percent} />
            </ProgressTrack>
            <TimeLabel variant="body3">{formatTime(duration)}</TimeLabel>
            <SpeedButton onClick={handleSpeedCycle} aria-label="Playback speed">
              {SPEED_OPTIONS[speedIndex]}x
            </SpeedButton>
          </MobileProgressRow>
        </MobileCard>
      </>
    )
  },
)

export default PodcastPlayer
