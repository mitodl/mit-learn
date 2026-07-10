import React from "react"
import { Link, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import type { LearningResource } from "api/v1"
import { SEARCH_PODCAST_EPISODES, podcastEpisodePageView } from "@/common/urls"
import { Section, SectionHeader, SectionTitle } from "./styled"
import { EpisodeItem } from "./EpisodeItem"
import { getEpisodeParentPodcastId } from "./helpers"

const EpisodeList = styled.div({
  display: "grid",
  gridTemplateColumns: "1fr",
})

const LoadMoreContainer = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "start",
  paddingTop: "40px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    paddingTop: "32px",
  },
}))

const LoadMoreEpisodeButton = styled(ButtonLink)(({ theme }) => ({
  padding: "12px 32px",
  height: "48px",
  fontSize: "16px",
  lineHeight: "16px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const StyledLink = styled(Link)(({ theme }) => ({
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: "150%", // 24px
  textDecorationLine: "underline",
  textDecorationStyle: "solid",
  textDecorationSkipInk: "none",
  textDecorationThickness: "auto",
  textUnderlineOffset: "auto",
  textUnderlinePosition: "from-font",
}))

export type LatestEpisodesSectionProps = {
  episodes: LearningResource[]
  isMobile: boolean
  playingEpisodeId?: number
  isAudioPlaying: boolean
  onPlayClick: (episode: LearningResource) => void
  onPauseClick: () => void
  hasMoreEpisodes: boolean
  isPlayable: (episode: LearningResource) => boolean
}

const LatestEpisodesSection: React.FC<LatestEpisodesSectionProps> = ({
  episodes,
  isMobile,
  playingEpisodeId,
  isAudioPlaying,
  onPlayClick,
  onPauseClick,
  hasMoreEpisodes,
  isPlayable,
}) => {
  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Latest Episodes</SectionTitle>
        <StyledLink color="red" href={SEARCH_PODCAST_EPISODES}>
          All episodes
        </StyledLink>
      </SectionHeader>
      {episodes.length > 0 && (
        <EpisodeList role="list">
          {episodes.map((episode) => {
            const parentPodcastId = getEpisodeParentPodcastId(episode)
            return (
              <EpisodeItem
                role="listitem"
                key={episode.id}
                isMobile={isMobile}
                episode={episode}
                overline={episode.offered_by?.name}
                href={
                  parentPodcastId
                    ? podcastEpisodePageView(
                        String(episode.id),
                        String(parentPodcastId),
                        episode.title,
                      )
                    : SEARCH_PODCAST_EPISODES
                }
                onPlayClick={onPlayClick}
                onPauseClick={onPauseClick}
                isPlaying={playingEpisodeId === episode.id && isAudioPlaying}
                isPlayable={isPlayable(episode)}
              />
            )
          })}
        </EpisodeList>
      )}
      {hasMoreEpisodes && (
        <LoadMoreContainer>
          <LoadMoreEpisodeButton
            variant="secondary"
            href={SEARCH_PODCAST_EPISODES}
          >
            Load more episodes
          </LoadMoreEpisodeButton>
        </LoadMoreContainer>
      )}
    </Section>
  )
}

export default LatestEpisodesSection
