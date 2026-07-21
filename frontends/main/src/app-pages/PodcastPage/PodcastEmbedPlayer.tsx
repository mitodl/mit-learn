"use client"

import React from "react"
import { styled } from "ol-components"
import {
  RiPlayCircleLine,
  RiPauseCircleLine,
  RiReplay10Line,
  RiForward30Line,
} from "@remixicon/react"
import type { LearningResource } from "api/v1"
import { getEpisodeAudioUrl } from "./PodcastsListingPage/helpers"
import { useAudioPlayer, formatClockTime } from "./useAudioPlayer"
import {
  TrackInfo as TrackInfoBase,
  TrackTitle,
  PodcastName,
  Controls,
  IconButton,
  PlayPauseButton,
  PlayerLoader,
  ProgressWrapper as ProgressWrapperBase,
  ProgressRange,
  TimeLabel,
  SpeedButton as SpeedButtonBase,
} from "./AudioPlayer.styled"

// ─── Styled components (card layout) ────────────────────────────────────────────

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

const TrackInfo = styled(TrackInfoBase)({
  gridArea: "info",
  gap: "4px",
  marginTop: "16px",
})

const ProgressWrapper = styled(ProgressWrapperBase)({
  gap: "8px",
})

const SpeedButton = styled(SpeedButtonBase)({
  padding: "4px 10px",
})

// ─── Component ────────────────────────────────────────────────────────────────

type PodcastEmbedPlayerProps = {
  resource: LearningResource
  inline?: boolean
}

const PodcastEmbedPlayer: React.FC<PodcastEmbedPlayerProps> = ({
  resource,
  inline = false,
}) => {
  // The embed player feeds this URL straight into an <audio> element, so it must
  // be a direct media file — never the (possibly webpage) episode_link fallback.
  const audioUrl =
    getEpisodeAudioUrl(resource, { allowEpisodeLink: false }) ?? ""

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
  } = useAudioPlayer(audioUrl)

  const Wrapper = inline ? InlineWrapper : Shell

  return (
    <Wrapper>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} {...audioProps} />

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
          <IconButton onClick={() => skip(-10)} aria-label="Rewind 10 seconds">
            <RiReplay10Line />
          </IconButton>

          <PlayPauseButton
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
              <PlayerLoader loading size={32} color="inherit" />
            ) : isPlaying ? (
              <RiPauseCircleLine />
            ) : (
              <RiPlayCircleLine />
            )}
          </PlayPauseButton>

          <IconButton onClick={() => skip(30)} aria-label="Forward 30 seconds">
            <RiForward30Line />
          </IconButton>

          <SpeedButton
            onClick={cycleSpeed}
            aria-label={`Playback speed: ${speed}x`}
          >
            {speed}x
          </SpeedButton>
        </Controls>

        <ProgressWrapper>
          <TimeLabel variant="body3">{formatClockTime(currentTime)}</TimeLabel>
          <ProgressRange
            type="range"
            min={0}
            max={duration || 1}
            value={currentTime}
            step={1}
            percent={percent}
            trackHeight={8}
            thumbSize={12}
            aria-valuetext={formatClockTime(currentTime)}
            aria-label="Seek"
            onChange={(e) => seek(Number(e.target.value))}
          />
          <TimeLabel variant="body3">{formatClockTime(duration)}</TimeLabel>
        </ProgressWrapper>
      </PlayerCard>
    </Wrapper>
  )
}

export default PodcastEmbedPlayer
