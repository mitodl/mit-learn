import type { PodcastEpisodeParent, PodcastEpisodeResource } from "api/v1"

// ISO-8601 duration pattern (e.g. "PT17M16S"). Schema.org requires this format
// for the `duration` property. Every component is optional, so the two
// negative lookaheads carry the "at least one component" rule: without them
// "P", "PT" and "P1DT" all pass and reach the JSON-LD as invalid durations.
const ISO_8601_DURATION_RE =
  /^P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?!$)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/

type BuildOptions = {
  /** Absolute canonical url of the episode page */
  url?: string
  /**
   * The parent podcast series the episode is being viewed under, as resolved
   * by `getEpisodeParentPodcast`. Required rather than picked from
   * `parent_podcasts[0]` here: an episode can belong to several series, and
   * choosing one independently of the caller would pair that series' name with
   * `seriesUrl`, which the caller builds from the parent in the current url.
   */
  series: PodcastEpisodeParent | null
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
  { url, series, seriesUrl }: BuildOptions,
): Record<string, unknown> | null {
  if (!episode || !episode.last_modified) return null

  const details = episode.podcast_episode

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
