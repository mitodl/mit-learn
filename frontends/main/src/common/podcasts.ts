import { ResourceTypeEnum } from "api/v1"
import type { LearningResource } from "api/v1"

/**
 * The URL to play/link for an episode.
 *
 * Defaults to the direct `audio_url`, falling back to `episode_link`. Pass
 * `{ allowEpisodeLink: false }` when the URL is fed straight into an `<audio>`
 * element (e.g. the embed player), since `episode_link` may point at a webpage
 * rather than a media file.
 *
 * Lives in common/ rather than with the podcast pages because both the listing
 * page (app-pages) and the embed player (page-components) need it, and
 * page-components may not import from app-pages.
 */
export const getEpisodeAudioUrl = (
  episode: LearningResource,
  { allowEpisodeLink = true }: { allowEpisodeLink?: boolean } = {},
): string | null => {
  if (episode.resource_type !== ResourceTypeEnum.PodcastEpisode) return null
  const candidateUrl = allowEpisodeLink
    ? (episode.podcast_episode?.audio_url ??
      episode.podcast_episode?.episode_link)
    : episode.podcast_episode?.audio_url
  return candidateUrl?.trim() ? candidateUrl.trim() : null
}
