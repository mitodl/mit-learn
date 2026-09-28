import moment from "moment"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource, PodcastEpisodeParent } from "api/v1"

// Defined in common/ so page-components can use it too; re-exported here to
// keep this module the single helper import for the podcast pages.
export { getEpisodeAudioUrl } from "@/common/podcasts"

export const formatApproxCount = (count: number): string =>
  count >= 100 ? `${Math.floor(count / 100) * 100}+` : String(count)

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
 * The parent podcast series an episode belongs to, from its embedded
 * `parent_podcasts` summary — the single source of truth across all podcast
 * pages.
 *
 * When an episode belongs to multiple podcasts, pass `podcastId` (e.g. the one
 * in the current URL) to select that specific series; this mirrors how the
 * page header/breadcrumb resolve the parent, so both stay in agreement. Falls
 * back to the first parent when no id is given or none matches.
 */
export const getEpisodeParentPodcast = (
  episode: LearningResource,
  podcastId?: number | null,
): PodcastEpisodeParent | null => {
  if (episode.resource_type !== ResourceTypeEnum.PodcastEpisode) return null
  const parents = episode.podcast_episode?.parent_podcasts
  const match =
    typeof podcastId === "number"
      ? parents?.find((parent) => parent.id === podcastId)
      : undefined
  return match ?? parents?.[0] ?? null
}

/**
 * The canonical "podcast name" shown for an episode (e.g. in the audio player).
 *
 * Resolves to the parent podcast series' title (see {@link getEpisodeParentPodcast}).
 * This is distinct from `offered_by.name`, which is the organization or
 * department credited with producing the episode, not the show name.
 */
export const getEpisodeParentPodcastName = (
  episode: LearningResource,
  podcastId?: number | null,
): string | null => getEpisodeParentPodcast(episode, podcastId)?.title ?? null
