import moment from "moment"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource } from "api/v1"

export const formatApproxCount = (count: number): string =>
  count >= 100 ? `${Math.floor(count / 100) * 100}+` : String(count)

export const getEpisodeAudioUrl = (
  episode: LearningResource,
): string | null => {
  if (episode.resource_type !== ResourceTypeEnum.PodcastEpisode) return null
  const candidateUrl =
    episode.podcast_episode?.audio_url ?? episode.podcast_episode?.episode_link
  return candidateUrl?.trim() ? candidateUrl : null
}

export const getEpisodeDurationMinutes = (
  episode: LearningResource,
): number | null => {
  if (episode.resource_type !== ResourceTypeEnum.PodcastEpisode) return null
  const duration = episode.podcast_episode?.duration
  return duration ? Math.round(moment.duration(duration).asMinutes()) : null
}

export const getEpisodeParentPodcastId = (
  episode: LearningResource,
): number | null => {
  if (episode.resource_type !== ResourceTypeEnum.PodcastEpisode) return null
  return episode.podcast_episode?.podcasts?.[0] ?? null
}

/**
 * The canonical "podcast name" shown for an episode (e.g. in the audio player).
 *
 * Resolves to the parent podcast series' title from the episode's embedded
 * `parent_podcasts` summary — the single source of truth across all podcast
 * pages. This is distinct from `offered_by.name`, which is the organization or
 * department credited with producing the episode, not the show name.
 */
export const getEpisodeParentPodcastName = (
  episode: LearningResource,
): string | null => {
  if (episode.resource_type !== ResourceTypeEnum.PodcastEpisode) return null
  return episode.podcast_episode?.parent_podcasts?.[0]?.title ?? null
}
