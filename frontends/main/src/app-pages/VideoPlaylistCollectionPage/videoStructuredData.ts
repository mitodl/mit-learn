import type { VideoResource } from "api/v1"

// ISO-8601 duration pattern (e.g. "PT2M0S"). Schema.org requires this format
// for the VideoObject `duration` property.
const ISO_8601_DURATION_RE =
  /^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/

/**
 * Builds a schema.org VideoObject structured-data payload for Google rich
 * results. Returns `null` when required fields are missing (Google requires at
 * minimum name, description, thumbnailUrl, and uploadDate).
 *
 * See: https://developers.google.com/search/docs/appearance/structured-data/video
 */
export function buildVideoStructuredData(
  video: VideoResource | undefined,
): Record<string, unknown> | null {
  if (!video || !video.last_modified) return null

  const captionUrls = video.video?.caption_urls ?? []

  const durationIso =
    video.video?.duration && ISO_8601_DURATION_RE.test(video.video.duration)
      ? video.video.duration
      : undefined

  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    ...(video.description ? { description: video.description } : {}),
    thumbnailUrl: video.video?.cover_image_url || video.image?.url || undefined,
    uploadDate: video.last_modified,
    contentUrl: video.url ?? undefined,
    ...(durationIso ? { duration: durationIso } : {}),
    ...(captionUrls.length > 0 ? { accessibilityFeature: ["captions"] } : {}),
  }
}
