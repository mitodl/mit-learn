import type { PodcastEpisodeResource } from "api/v1"

// ISO-8601 duration pattern (e.g. "PT17M16S"). Schema.org requires this format
// for the `duration` property.
const ISO_8601_DURATION_RE =
  /^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/

type BuildOptions = {
  /** Absolute canonical url of the episode page */
  url?: string
  /** Absolute canonical url of the parent podcast page */
  seriesUrl?: string
}

/**
 * Builds a schema.org PodcastEpisode structured-data payload.
 *
 * The transcript text itself is deliberately not included. `schema.org`'s
 * `transcript` property has a `domainIncludes` of `AudioObject` and
 * `VideoObject` only -- it is not a `PodcastEpisode` property -- and no Google
 * rich result consumes it, so emitting tens of kilobytes of duplicate text
 * would roughly double the page weight for nothing. `accessibilityFeature`
 * (a `CreativeWork` property, with `transcript` a valid W3C a11y-vocab value)
 * carries the signal instead; the transcript itself is already crawlable in
 * the tab panel.
 *
 * See: https://schema.org/PodcastEpisode
 */
export function buildPodcastEpisodeStructuredData(
  episode: PodcastEpisodeResource | undefined,
  { url, seriesUrl }: BuildOptions = {},
): Record<string, unknown> | null {
  if (!episode || !episode.last_modified) return null

  const details = episode.podcast_episode
  const series = episode.podcast_episode?.parent_podcasts?.[0]

  const durationIso =
    details?.duration && ISO_8601_DURATION_RE.test(details.duration)
      ? details.duration
      : undefined

  return {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    name: episode.title,
    ...(episode.description ? { description: episode.description } : {}),
    ...(url ? { url } : {}),
    datePublished: episode.last_modified,
    ...(episode.image?.url ? { image: episode.image.url } : {}),
    ...(durationIso ? { duration: durationIso } : {}),
    ...(details?.audio_url
      ? {
          associatedMedia: {
            "@type": "AudioObject",
            contentUrl: details.audio_url,
          },
        }
      : {}),
    ...(series
      ? {
          partOfSeries: {
            "@type": "PodcastSeries",
            name: series.title,
            ...(seriesUrl ? { url: seriesUrl } : {}),
          },
        }
      : {}),
    ...(details?.has_transcript
      ? { accessibilityFeature: ["transcript"] }
      : {}),
  }
}
