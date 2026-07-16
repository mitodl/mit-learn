import React from "react"
import { Link, Skeleton, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import type { LearningResource, PodcastEpisodeResource } from "api/v1"
import { SEARCH_PODCAST_EPISODES, podcastEpisodePageView } from "@/common/urls"
import {
  Section,
  SectionHeader,
  SectionTitle,
  SectionMessage,
  EpisodeList,
} from "./styled"
import { EpisodeItem } from "./EpisodeItem"
import { getEpisodeParentPodcastId } from "./helpers"
import { EPISODES_PAGE_SIZE } from "./constants"

const EpisodeSkeletonRow = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "24px 16px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const EpisodesSkeleton = () => (
  <EpisodeList>
    {Array.from({ length: EPISODES_PAGE_SIZE }, (_unused, i) => (
      <EpisodeSkeletonRow key={i}>
        <Skeleton variant="text" width="30%" height={16} />
        <Skeleton variant="text" width="60%" height={26} />
      </EpisodeSkeletonRow>
    ))}
  </EpisodeList>
)

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
  isLoading?: boolean
  isError?: boolean
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
  isLoading = false,
  isError = false,
}) => {
  return (
    <Section>
      <SectionHeader>
        <SectionTitle>Latest Episodes</SectionTitle>
        <StyledLink color="red" href={SEARCH_PODCAST_EPISODES}>
          All episodes
        </StyledLink>
      </SectionHeader>
      {isLoading && <EpisodesSkeleton />}
      {!isLoading && isError && (
        <SectionMessage variant="body1">
          Something went wrong loading episodes. Please try again later.
        </SectionMessage>
      )}
      {!isLoading && !isError && episodes.length === 0 && (
        <SectionMessage variant="body1">
          No episodes available right now.
        </SectionMessage>
      )}
      {!isLoading && !isError && episodes.length > 0 && (
        <EpisodeList role="list">
          {episodes.map((episode) => {
            const parentPodcastId = getEpisodeParentPodcastId(episode)
            const podcastTitles = (
              episode as PodcastEpisodeResource
            ).podcast_episode?.parent_podcasts
              ?.map((p) => p.title)
              .join(", ")
            const overline = [podcastTitles, episode.offered_by?.name]
              .filter(Boolean)
              .join(" · ")
            return (
              <EpisodeItem
                role="listitem"
                key={episode.id}
                isMobile={isMobile}
                episode={episode}
                overline={overline}
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
