import React, { useRef, useState } from "react"
import { styled, Typography } from "ol-components"
import { PodcastEpisodeResource } from "api"
import { RiMicLine, RiPlayCircleFill } from "@remixicon/react"
import PodcastPlayer, {
  PodcastPlayerHandle,
  PodcastTrack,
} from "./PodcastPlayer"

const EpisodesCard = styled.div(({ theme }) => ({
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  width: "100%",
  [theme.breakpoints.down("sm")]: {
    padding: "16px 0",
    marginTop: "16px",
  },
}))

const EpisodesHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: theme.custom.colors.white,
}))

const EpisodeRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  backgroundColor: theme.custom.colors.white,
  borderRadius: "8px",
  height: "115px",
}))

const EpisodeThumbnail = styled("img")({
  width: "115px",
  height: "115px",
  borderTopLeftRadius: "4px",
  borderBottomLeftRadius: "4px",
  objectFit: "cover",
  flexShrink: 0,
})

const EpisodeInfo = styled.div({
  flex: 1,
  minWidth: 0,
  padding: "16px",
})

const EpisodePlayOffButton = styled.div(({ theme }) => ({
  borderRadius: "100px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  background: theme.custom.colors.white,
  padding: "4px 16px 4px 4px",
  width: "70px",
  alignItems: "center",
  display: "flex",
  cursor: "pointer",
}))

const EpisodePlayOnButton = styled.div(({ theme }) => ({
  borderRadius: "100px",
  border: `1px solid ${theme.custom.colors.mitRed}`,
  background: theme.custom.colors.mitRed,
  padding: "4px 16px 4px 4px",
  width: "70px",
  alignItems: "center",
  display: "flex",
  cursor: "pointer",
}))

const EpisodeChannelName = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.mitRed,
  marginBottom: "4px",
  ...theme.typography.body3,
}))

const EpisodeTitle = styled(Typography)(({ theme }) => ({
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  color: theme.custom.colors.darkGray2,
  marginBottom: "8px",
  ...theme.typography.body2,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
}))

const PlayButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "isplaying",
})<{ isplaying?: string }>(({ theme, isplaying }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0,
  textDecoration: "none",
  ...theme.typography.body3,
  color:
    isplaying === "true"
      ? theme.custom.colors.white
      : theme.custom.colors.mitRed,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  "&:hover": {
    opacity: 0.8,
  },
}))

interface RecentEpisodesPanelProps {
  episodes: PodcastEpisodeResource[]
}

const RecentEpisodesPanel: React.FC<RecentEpisodesPanelProps> = ({
  episodes,
}) => {
  const [activeTrack, setActiveTrack] = useState<PodcastTrack | null>(null)
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false)
  const playerRef = useRef<PodcastPlayerHandle>(null)

  return (
    <>
      <EpisodesCard>
        <EpisodesHeader>
          <RiMicLine size={20} />
          <Typography variant="subtitle2">RECENT EPISODES</Typography>
        </EpisodesHeader>
        {episodes.map((episode) => (
          <EpisodeRow key={episode.id}>
            {episode.image?.url ? (
              <EpisodeThumbnail
                src={episode.image.url}
                alt={episode.image.alt ?? episode.title}
              />
            ) : null}
            <EpisodeInfo>
              <EpisodeChannelName>{"Curiosity Unbounded"}</EpisodeChannelName>
              <EpisodeTitle>{episode.title}</EpisodeTitle>
              {episode.podcast_episode?.audio_url
                ? (() => {
                    const isPlaying =
                      activeTrack?.audioUrl ===
                        episode.podcast_episode.audio_url && isActuallyPlaying
                    const ButtonWrapper = isPlaying
                      ? EpisodePlayOnButton
                      : EpisodePlayOffButton
                    return (
                      <ButtonWrapper>
                        <PlayButton
                          isplaying={isPlaying ? "true" : undefined}
                          onClick={() => {
                            const audioUrl = episode.podcast_episode.audio_url!
                            if (activeTrack?.audioUrl === audioUrl) {
                              playerRef.current?.togglePlayPause()
                            } else {
                              setActiveTrack({
                                audioUrl,
                                title: episode.title,
                                podcastName:
                                  episode.offered_by?.name ??
                                  "Me, Myself, and AI",
                              })
                            }
                          }}
                        >
                          <RiPlayCircleFill size={24} />
                          Play
                        </PlayButton>
                      </ButtonWrapper>
                    )
                  })()
                : null}
            </EpisodeInfo>
          </EpisodeRow>
        ))}
      </EpisodesCard>
      {activeTrack ? (
        <PodcastPlayer
          ref={playerRef}
          track={activeTrack}
          onPlayStateChange={setIsActuallyPlaying}
          onClose={() => {
            setActiveTrack(null)
            setIsActuallyPlaying(false)
          }}
        />
      ) : null}
    </>
  )
}

export default RecentEpisodesPanel
