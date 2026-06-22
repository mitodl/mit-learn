"use client"

import React, { useRef, useState, useEffect, useCallback } from "react"
import { styled, Typography, LoadingSpinner } from "ol-components"
import {
  RiPlayCircleLine,
  RiPauseCircleLine,
  RiReplay10Line,
  RiForward30Line,
} from "@remixicon/react"
import type { LearningResource } from "api/v1"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2]

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function getAudioUrl(resource: LearningResource): string {
  if (resource.resource_type !== "podcast_episode") return ""
  return resource.podcast_episode?.audio_url ?? ""
}

// ─── Styled components ────────────────────────────────────────────────────────

const Shell = styled.div(({ theme }) => ({
  width: "100vw",
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.custom.colors.white,
  padding: "24px",
  boxSizing: "border-box",
}))

const InlineWrapper = styled.div(({ theme }) => ({
  width: "100%",
  backgroundColor: theme.custom.colors.white,
  padding: "24px",
  boxSizing: "border-box",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
}))

const PlayerCard = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gridTemplateAreas: '"art info" "art controls" "art progress"',
  gap: "12px 24px",
  width: "100%",
  maxWidth: "80%",
  alignItems: "start",
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
    gridTemplateAreas: '"art" "info" "controls" "progress"',
  },
}))

const CoverArt = styled.img(({ theme }) => ({
  gridArea: "art",
  width: "200px",
  height: "200px",
  objectFit: "cover",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  alignSelf: "center",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    height: "auto",
  },
}))

const CoverArtPlaceholder = styled.div(({ theme }) => ({
  gridArea: "art",
  width: "200px",
  height: "200px",
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.lightGray2,
  alignSelf: "center",
  [theme.breakpoints.down("sm")]: {
    width: "80px",
    height: "80px",
  },
}))

const TrackInfo = styled.div({
  gridArea: "info",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  marginTop: "16px",
  minWidth: 0,
})

const TrackTitle = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: theme.custom.colors.black,
}))

const PodcastName = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const Controls = styled.div({
  gridArea: "controls",
  display: "flex",
  alignItems: "center",
  gap: "12px",
})

const IconButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  alignItems: "center",
  color: theme.custom.colors.silverGray,
  "&:hover": { color: theme.custom.colors.red },
  "& svg": { width: "24px", height: "24px" },
}))

const PlayPauseButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "48px",
  height: "48px",
  flexShrink: 0,
  overflow: "hidden",
  color: theme.custom.colors.red,
  "&:hover": { opacity: 0.8 },
  "& > svg": { width: "48px", height: "48px" },
}))

const PlayerLoader = styled(LoadingSpinner)({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
})

const ProgressWrapper = styled.div({
  gridArea: "progress",
  display: "flex",
  alignItems: "center",
  gap: "8px",
})

const ProgressRange = styled.input<{ percent: number }>(
  ({ theme, percent }) => ({
    appearance: "none",
    WebkitAppearance: "none",
    flex: 1,
    height: "8px",
    borderRadius: "4px",
    cursor: "pointer",
    outline: "none",
    border: "none",
    padding: 0,
    background: `linear-gradient(to right, ${theme.custom.colors.red} ${percent}%, ${theme.custom.colors.lightGray2} ${percent}%)`,
    "&::-webkit-slider-thumb": {
      WebkitAppearance: "none",
      width: "12px",
      height: "12px",
      borderRadius: "50%",
      background: theme.custom.colors.red,
      cursor: "pointer",
    },
    "&::-moz-range-thumb": {
      width: "12px",
      height: "12px",
      borderRadius: "50%",
      background: theme.custom.colors.red,
      border: "none",
      cursor: "pointer",
    },
  }),
)

const TimeLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
  flexShrink: 0,
  minWidth: "38px",
  textAlign: "center",
}))

const SpeedButton = styled.button(({ theme }) => ({
  background: theme.custom.colors.lightGray1,
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  borderRadius: "4px",
  padding: "4px 10px",
  cursor: "pointer",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  flexShrink: 0,
  "&:hover": {
    borderColor: theme.custom.colors.red,
    color: theme.custom.colors.red,
  },
}))

// ─── Component ────────────────────────────────────────────────────────────────

type PodcastEmbedPlayerProps = {
  resource: LearningResource
  inline?: boolean
}

const PodcastEmbedPlayer: React.FC<PodcastEmbedPlayerProps> = ({
  resource,
  inline = false,
}) => {
  const audioUrl = getAudioUrl(resource)
  const hasAudioSource = Boolean(audioUrl.trim())
  const audioRef = useRef<HTMLAudioElement>(null)
  const isPlayPendingRef = useRef(false)
  const playAttemptIdRef = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [isPlayPending, setIsPlayPending] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(1)
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
      if (playAttemptIdRef.current === attemptId) setIsPlaying(true)
    } catch {
      if (playAttemptIdRef.current === attemptId) setIsPlaying(false)
    } finally {
      if (playAttemptIdRef.current === attemptId) {
        isPlayPendingRef.current = false
        setIsPlayPending(false)
      }
    }
  }, [hasAudioSource])

  useEffect(() => {
    playAttemptIdRef.current += 1
    isPlayPendingRef.current = false
    setIsPlayPending(false)
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
    setIsBuffering(false)

    if (!hasAudioSource) return

    const audio = audioRef.current
    if (!audio) return
    audio.load()
    audio.playbackRate = SPEED_OPTIONS[speedIndexRef.current]
  }, [audioUrl, hasAudioSource, startPlayback])

  const handlePlayPause = () => {
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
    if (audioRef.current)
      audioRef.current.playbackRate = SPEED_OPTIONS[nextIndex]
  }

  const percent = duration ? (currentTime / duration) * 100 : 0

  const Wrapper = inline ? InlineWrapper : Shell

  return (
    <Wrapper>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={hasAudioSource ? audioUrl : undefined}
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

      <PlayerCard style={inline ? { maxWidth: "100%" } : undefined}>
        {resource.image?.url ? (
          <CoverArt
            src={resource.image.url}
            alt={resource.image.alt ?? resource.title ?? "Episode cover"}
          />
        ) : (
          <CoverArtPlaceholder />
        )}

        <TrackInfo style={inline ? { marginTop: 0 } : undefined}>
          <PodcastName
            variant="body2"
            style={inline ? { marginTop: "20px" } : undefined}
          >
            {resource.offered_by?.name ?? "Podcast"}
          </PodcastName>
          <TrackTitle variant="subtitle2">{resource.title}</TrackTitle>
        </TrackInfo>

        <Controls>
          <IconButton
            onClick={() => handleSkip(-10)}
            aria-label="Rewind 10 seconds"
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
              <PlayerLoader loading size={32} color="inherit" />
            ) : isPlaying ? (
              <RiPauseCircleLine />
            ) : (
              <RiPlayCircleLine />
            )}
          </PlayPauseButton>

          <IconButton
            onClick={() => handleSkip(30)}
            aria-label="Forward 30 seconds"
          >
            <RiForward30Line />
          </IconButton>

          <SpeedButton
            onClick={handleSpeedCycle}
            aria-label={`Playback speed: ${SPEED_OPTIONS[speedIndex]}x`}
          >
            {SPEED_OPTIONS[speedIndex]}x
          </SpeedButton>
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
            aria-valuetext={formatTime(currentTime)}
            aria-label="Seek"
            onChange={(e) => {
              const audio = audioRef.current
              if (!audio) return
              audio.currentTime = Number(e.target.value)
            }}
          />
          <TimeLabel variant="body3">{formatTime(duration)}</TimeLabel>
        </ProgressWrapper>
      </PlayerCard>
    </Wrapper>
  )
}

export default PodcastEmbedPlayer
