"use client"

import React, { useRef, useState, useEffect, useCallback } from "react"
import { styled, Typography, LoadingSpinner } from "ol-components"
import {
  RiPlayCircleLine,
  RiPauseCircleLine,
  RiReplay10Line,
  RiForward30Line,
  RiCloseLine,
} from "@remixicon/react"

// ─── Types ────────────────────────────────────────────────────────────────────

/** Height of the fixed player bar. Used by the page to add compensating bottom padding. */
export const PLAYER_HEIGHT = { desktop: 104, mobile: 220 }

export type PodcastTrack = {
  audioUrl: string
  title: string
  podcastName: string
}

type PodcastPlayerProps = {
  track: PodcastTrack
  onClose: () => void
  onPlayStateChange?: (isPlaying: boolean) => void
}

// ─── Styled components ────────────────────────────────────────────────────────

const PlayerShell = styled.div(({ theme }) => ({
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: theme.zIndex.appBar + 10,
  display: "grid",
  gridTemplateColumns: "390px 1px auto minmax(0, 1fr) auto auto",
  gridTemplateAreas: '"track divider controls progress speed close"',
  alignItems: "center",
  gap: "24px",
  padding: "32px",
  background: theme.custom.colors.white,
  borderTop: `2px solid ${theme.custom.colors.mitRed}`,
  boxShadow: "0 -4px 16px rgba(0,0,0,0.12)",
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gridTemplateAreas:
      '"track close" "controls controls" "progress progress" "speed speed"',
    gap: "16px",
    padding: "24px",
    borderRadius: "12px 12px 0 0",
    boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
  },
}))

const TrackInfo = styled.div({
  gridArea: "track",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  minWidth: 0,
})

const Divider = styled.div(({ theme }) => ({
  gridArea: "divider",
  width: "1px",
  height: "40px",
  backgroundColor: theme.custom.colors.lightGray2,
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const Controls = styled.div(({ theme }) => ({
  gridArea: "controls",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    justifyContent: "center",
    gap: "32px",
  },
}))

const IconButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  alignItems: "center",
  color: theme.custom.colors.silverGray,
  "&:hover": { color: theme.custom.colors.mitRed },
  "& svg": {
    width: "24px",
    height: "24px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "8px",
    "& svg": {
      width: "32px",
      height: "32px",
    },
  },
}))

const PlayPauseButton = styled.button(({ theme }) => ({
  gridArea: "play",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  // Fixed size + overflow:hidden keeps the spinner clipped inside the button.
  // The spinner is absolutely centered; play/pause icons fill the same area.
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "64px",
  height: "64px",
  flexShrink: 0,
  overflow: "hidden",
  color: theme.custom.colors.mitRed,
  "&:hover": { opacity: 0.8 },
  // Target only direct SVG children (Remix icons) — not the spinner's SVG.
  "& > svg": {
    width: "64px",
    height: "64px",
  },
  [theme.breakpoints.down("sm")]: {
    width: "56px",
    height: "56px",
    "& > svg": {
      width: "56px",
      height: "56px",
    },
  },
}))

const TimeLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
  flexShrink: 0,
  minWidth: "38px",
  textAlign: "center",
}))

const TrackTitle = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "18px",
  lineHeight: "26px",
  color: theme.custom.colors.black,
  [theme.breakpoints.down("sm")]: {
    display: "-webkit-box",
    whiteSpace: "normal",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
}))

const PodcastName = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const PodcastPlayerLoader = styled(LoadingSpinner)({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
})

const ProgressWrapper = styled.div(({ theme }) => ({
  gridArea: "progress",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minWidth: 0,
  [theme.breakpoints.down("sm")]: {
    gap: "8px",
  },
}))

const ProgressRange = styled.input<{ percent: number }>(
  ({ theme, percent }) => ({
    appearance: "none",
    WebkitAppearance: "none",
    flex: 1,
    height: "12px",
    borderRadius: "6px",
    cursor: "pointer",
    outline: "none",
    border: "none",
    padding: 0,
    background: `linear-gradient(to right, ${theme.custom.colors.mitRed} ${percent}%, ${theme.custom.colors.lightGray2} ${percent}%)`,
    "&::-webkit-slider-thumb": {
      WebkitAppearance: "none",
      width: "14px",
      height: "14px",
      borderRadius: "50%",
      background: theme.custom.colors.mitRed,
      cursor: "pointer",
    },
    "&::-moz-range-thumb": {
      width: "14px",
      height: "14px",
      borderRadius: "50%",
      background: theme.custom.colors.mitRed,
      border: "none",
      cursor: "pointer",
    },
  }),
)

const SpeedButton = styled.button(({ theme }) => ({
  gridArea: "speed",
  background: "white",
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  backgroundColor: theme.custom.colors.lightGray1,
  borderRadius: "4px",
  padding: "4px 12px",
  cursor: "pointer",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  flexShrink: 0,
  "&:hover": {
    borderColor: theme.custom.colors.mitRed,
    color: theme.custom.colors.mitRed,
  },
  [theme.breakpoints.down("sm")]: {
    justifySelf: "end",
  },
}))

const CloseButton = styled.button(({ theme }) => ({
  gridArea: "close",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  alignItems: "center",
  color: theme.custom.colors.darkGray2,
  flexShrink: 0,
  "&:hover": {
    backgroundColor: theme.custom.colors.red,
    color: theme.custom.colors.white,
    width: "32px",
    height: "32px",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
  },
  justifySelf: "end",
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2]

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// ─── Component ────────────────────────────────────────────────────────────────

const PodcastPlayer = ({
  track,
  onClose,
  onPlayStateChange,
}: PodcastPlayerProps) => {
  const hasAudioSource = Boolean(track.audioUrl.trim())
  const audioRef = useRef<HTMLAudioElement>(null)
  const isPlayPendingRef = useRef(false)
  const playAttemptIdRef = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(true)
  const [isPlayPending, setIsPlayPending] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(1) // default 1x
  const speedIndexRef = useRef(1)

  const startPlayback = useCallback(async () => {
    if (!hasAudioSource || isPlayPendingRef.current) return

    const audio = audioRef.current
    if (!audio) return

    const attemptId = ++playAttemptIdRef.current
    isPlayPendingRef.current = true
    setIsPlayPending(true)

    try {
      await audio.play()
      if (playAttemptIdRef.current === attemptId) {
        setIsPlaying(true)
      }
    } catch {
      if (playAttemptIdRef.current === attemptId) {
        setIsPlaying(false)
      }
    } finally {
      if (playAttemptIdRef.current === attemptId) {
        isPlayPendingRef.current = false
        setIsPlayPending(false)
      }
    }
  }, [hasAudioSource])

  // Auto-play when a new track is loaded
  useEffect(() => {
    // Invalidate any in-flight play attempt from a previous track.
    playAttemptIdRef.current += 1
    isPlayPendingRef.current = false
    setIsPlayPending(false)

    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
    setIsBuffering(hasAudioSource)

    if (!hasAudioSource) {
      return
    }

    const audio = audioRef.current
    if (!audio) return
    audio.load()
    audio.playbackRate = SPEED_OPTIONS[speedIndexRef.current]
    void startPlayback()
  }, [track.audioUrl, hasAudioSource, startPlayback])

  const handlePlayPause = async () => {
    if (!hasAudioSource) return

    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      void startPlayback()
    }
  }

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

  const handleSeekKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return

    event.preventDefault()
    handleSkip(event.key === "ArrowRight" ? 5 : -5)
  }

  const percent = duration ? (currentTime / duration) * 100 : 0
  return (
    <>
      {/* Shared audio element */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={hasAudioSource ? track.audioUrl : undefined}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onError={() => {
          setIsBuffering(false)
          setIsPlaying(false)
        }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => setIsPlaying(false)}
      />

      <PlayerShell>
        <TrackInfo>
          <PodcastName variant="body1" sx={{ color: "text.secondary" }}>
            {track.podcastName}
          </PodcastName>
          <TrackTitle variant="subtitle2">{track.title}</TrackTitle>
        </TrackInfo>

        <Divider />

        <Controls>
          <IconButton
            onClick={() => handleSkip(-10)}
            aria-label="Rewind 10 seconds"
            title="Rewind 10s"
          >
            <RiReplay10Line />
          </IconButton>

          <PlayPauseButton
            onClick={handlePlayPause}
            aria-label={
              !hasAudioSource
                ? "Play unavailable"
                : isBuffering || isPlayPending
                  ? "Loading"
                  : isPlaying
                    ? "Pause"
                    : "Play"
            }
            disabled={isBuffering || isPlayPending || !hasAudioSource}
          >
            {isBuffering || isPlayPending ? (
              <PodcastPlayerLoader loading size={40} color="inherit" />
            ) : isPlaying ? (
              <RiPauseCircleLine />
            ) : (
              <RiPlayCircleLine />
            )}
          </PlayPauseButton>

          <IconButton
            onClick={() => handleSkip(30)}
            aria-label="Forward 30 seconds"
            title="Forward 30s"
          >
            <RiForward30Line />
          </IconButton>
        </Controls>

        <ProgressWrapper>
          <TimeLabel variant="body3">{formatTime(currentTime)}</TimeLabel>
          <ProgressRange
            type="range"
            min={0}
            max={duration || 1}
            value={currentTime}
            step={1}
            percent={percent}
            aria-label="Seek"
            onChange={(e) => {
              const audio = audioRef.current
              if (!audio) return
              audio.currentTime = Number(e.target.value)
            }}
            onKeyDown={handleSeekKeyDown}
          />
          <TimeLabel variant="body3">{formatTime(duration)}</TimeLabel>

          <SpeedButton onClick={handleSpeedCycle} aria-label="Playback speed">
            {SPEED_OPTIONS[speedIndex]}x
          </SpeedButton>
        </ProgressWrapper>

        {/* Close */}
        <CloseButton onClick={onClose} aria-label="Close player">
          <RiCloseLine size={24} />
        </CloseButton>
      </PlayerShell>
    </>
  )
}

export default PodcastPlayer
