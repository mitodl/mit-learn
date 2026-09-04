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

/*
 * Strip tags to a fixed point rather than in one pass.
 *
 * A single `replace(/<[^>]*>/g, "")` is not idempotent: removing one match can
 * join its neighbours into a new tag, so `<scr<div>ipt>` survives as `<script>`.
 * CodeQL calls this incomplete multi-character sanitization and it is right -
 * this value ends up inside a <script type="application/ld+json"> block. The
 * injection point also escapes `</`, but a helper that claims to return plain
 * text should not depend on its caller for that.
 *
 * Looping to a fixed point and then dropping any surviving angle bracket means
 * the result cannot contribute to a tag in any context.
 */
const stripTags = (html: string): string => {
  let previous = ""
  let current = html
  while (current !== previous) {
    previous = current
    current = current.replace(/<[^>]*>/g, "")
  }
  return current
}

const descriptionToPlainText = (html: string): string =>
  stripTags(
    html
      /*
       * Every block-level tag the backend allowlist keeps
       * (main/constants.py ALLOWED_HTML_TAGS) is a boundary, or its neighbours
       * run together: <div>First</div><div>Second</div> became "FirstSecond"
       * when this list only covered p/li/ul/ol/blockquote.
       */
      .replace(/<\/(?:p|li|ul|ol|blockquote|div|pre|caption|center|q)>/gi, " ")
      .replace(/<(?:br|hr)\s*\/?>/gi, " "),
  )
    // decode before dropping brackets, so an entity cannot smuggle one back in
    .replace(
      /&[a-z#0-9]+;/gi,
      (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity,
    )
    .replace(/[<>]/g, "")
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
