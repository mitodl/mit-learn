"use client"

import React, { forwardRef, useImperativeHandle } from "react"
import { styled } from "ol-components"
import {
  RiPlayCircleLine,
  RiPauseCircleLine,
  RiReplay10Line,
  RiForward30Line,
  RiCloseLine,
} from "@remixicon/react"
import { useAudioPlayer, formatClockTime } from "./useAudioPlayer"
import {
  TrackInfo as TrackInfoBase,
  TrackTitle as TrackTitleBase,
  PodcastName,
  Controls as ControlsBase,
  IconButton as IconButtonBase,
  PlayPauseButton,
  PlayerLoader,
  ProgressWrapper as ProgressWrapperBase,
  ProgressRange,
  TimeLabel,
  SpeedButton as SpeedButtonBase,
} from "./AudioPlayer.styled"

// ─── Types ────────────────────────────────────────────────────────────────────

/** Height of the fixed player bar. Used by the page to add compensating bottom padding. */
export const PLAYER_HEIGHT = { desktop: 104, mobile: 220 }

export type PodcastTrack = {
  audioUrl: string
  title: string
  podcastName: string
}

export type PodcastPlayerHandle = {
  pause: () => void
  resume: () => void
}

type PodcastPlayerProps = {
  track: PodcastTrack
  onClose: () => void
  onPlayStateChange?: (isPlaying: boolean) => void
}

// ─── Styled components (fixed-bar layout) ───────────────────────────────────────

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
  borderTop: `2px solid ${theme.custom.colors.red}`,
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

const TrackInfo = styled(TrackInfoBase)({
  gridArea: "track",
  gap: "2px",
})

const TrackTitle = styled(TrackTitleBase)(({ theme }) => ({
  fontSize: "18px",
  lineHeight: "26px",
  [theme.breakpoints.down("sm")]: {
    display: "-webkit-box",
    whiteSpace: "normal",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
}))

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

const Controls = styled(ControlsBase)(({ theme }) => ({
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    justifyContent: "center",
    gap: "32px",
  },
}))

const IconButton = styled(IconButtonBase)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    padding: "8px",
    "& svg": {
      width: "32px",
      height: "32px",
    },
  },
}))

const ProgressWrapper = styled(ProgressWrapperBase)(({ theme }) => ({
  gap: "12px",
  minWidth: 0,
  [theme.breakpoints.down("sm")]: {
    gap: "8px",
  },
}))

const SpeedButton = styled(SpeedButtonBase)(({ theme }) => ({
  gridArea: "speed",
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
  width: "32px",
  height: "32px",
  "&:hover": {
    backgroundColor: theme.custom.colors.red,
    color: theme.custom.colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
  },
  justifySelf: "end",
}))

// ─── Component ────────────────────────────────────────────────────────────────

const PodcastPlayer = forwardRef<PodcastPlayerHandle, PodcastPlayerProps>(
  ({ track, onClose, onPlayStateChange }, ref) => {
    const {
      audioRef,
      audioProps,
      hasAudioSource,
      isPlaying,
      isBuffering,
      isPlayPending,
      currentTime,
      duration,
      percent,
      speed,
      togglePlay,
      skip,
      cycleSpeed,
      seek,
      pause,
      resume,
    } = useAudioPlayer(track.audioUrl, { autoPlay: true, onPlayStateChange })

    useImperativeHandle(ref, () => ({ pause, resume }), [pause, resume])

    const handleSeekKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      event.preventDefault()
      skip(event.key === "ArrowRight" ? 5 : -5)
    }

    return (
      <>
        {/* Shared audio element */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={audioRef} {...audioProps} />

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
              onClick={() => skip(-10)}
              aria-label="Rewind 10 seconds"
              title="Rewind 10s"
            >
              <RiReplay10Line />
            </IconButton>

            <PlayPauseButton
              buttonSize={64}
              mobileButtonSize={56}
              onClick={togglePlay}
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
                <PlayerLoader loading size={40} color="inherit" />
              ) : isPlaying ? (
                <RiPauseCircleLine />
              ) : (
                <RiPlayCircleLine />
              )}
            </PlayPauseButton>

            <IconButton
              onClick={() => skip(30)}
              aria-label="Forward 30 seconds"
              title="Forward 30s"
            >
              <RiForward30Line />
            </IconButton>
          </Controls>

          <ProgressWrapper>
            <TimeLabel variant="body3">
              {formatClockTime(currentTime)}
            </TimeLabel>
            <ProgressRange
              type="range"
              min={0}
              max={duration || 1}
              value={currentTime}
              step={1}
              percent={percent}
              aria-label="Seek"
              onChange={(e) => seek(Number(e.target.value))}
              onKeyDown={handleSeekKeyDown}
            />
            <TimeLabel variant="body3">{formatClockTime(duration)}</TimeLabel>

            <SpeedButton onClick={cycleSpeed} aria-label="Playback speed">
              {speed}x
            </SpeedButton>
          </ProgressWrapper>

          {/* Close */}
          <CloseButton onClick={onClose} aria-label="Close player">
            <RiCloseLine size={24} />
          </CloseButton>
        </PlayerShell>
      </>
    )
  },
)

export default PodcastPlayer
