import type { PodcastEpisodeParent, PodcastEpisodeResource } from "api/v1"

// ISO-8601 duration pattern (e.g. "PT17M16S"). Schema.org requires this format
// for the `duration` property. Every component is optional, so the two
// negative lookaheads carry the "at least one component" rule: without them
// "P", "PT" and "P1DT" all pass and reach the JSON-LD as invalid durations.
const ISO_8601_DURATION_RE =
  /^P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?!$)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/

/**
 * Builds a schema.org PodcastEpisode structured-data payload.
 *
 * Every URL here is canonical, taken from the episode rather than from the page
 * rendering it. An episode in several podcasts is viewable under any of them, so
 * a page that passed in its own parent would pair one series' name with another
 * series' `url`. `parent_podcasts[0]` is the parent `learn_url` was built from.
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
): Record<string, unknown> | null {
  if (!episode || !episode.last_modified) return null

  const details = episode.podcast_episode
  const series: PodcastEpisodeParent | undefined = details?.parent_podcasts?.[0]

  const durationIso =
    details?.duration && ISO_8601_DURATION_RE.test(details.duration)
      ? details.duration
      : undefined

  return {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    name: episode.title,
    ...(episode.description ? { description: episode.description } : {}),
    url: episode.learn_url,
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
            url: series.learn_url,
          },
        }
      : {}),
    ...(details?.has_transcript
      ? { accessibilityFeature: ["transcript"] }
      : {}),
  }
}
