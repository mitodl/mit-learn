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
/*
 * schema.org values are plain text, so the description has to be stripped of
 * the markup OVS now sends. Deliberately not common/htmlToPlainText: that is
 * documented server-only because it pulls in isomorphic-dompurify (jsdom), and
 * this module is imported by a "use client" component. The input is already
 * sanitized to a small tag set during ETL, so a strip plus the handful of
 * entities nh3 emits is sufficient here.
 */
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
}

const descriptionToPlainText = (html: string): string =>
  html
    // block boundaries become spaces, or adjacent paragraphs run together
    .replace(/<\/(?:p|li|ul|ol|blockquote)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&[a-z#0-9]+;/gi,
      (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity,
    )
    .replace(/\s+/g, " ")
    .trim()

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
    ...(video.description
      ? { description: descriptionToPlainText(video.description) }
      : {}),
    thumbnailUrl: video.video?.cover_image_url || video.image?.url || undefined,
    uploadDate: video.last_modified,
    contentUrl: video.url ?? undefined,
    ...(durationIso ? { duration: durationIso } : {}),
    ...(captionUrls.length > 0 ? { accessibilityFeature: ["captions"] } : {}),
  }
}
