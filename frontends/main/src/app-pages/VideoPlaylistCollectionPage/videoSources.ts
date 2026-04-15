import type { VideoJsSource } from "./VideoJsPlayer"

/**
 * Derive the correct video.js source object from a VideoResource.
 * Prefers direct streaming_url; falls back to the YouTube page URL.
 *
 * Lives in its own module so it can be imported without pulling in the
 * heavy video.js bundle that VideoJsPlayer requires.
 */
export function resolveVideoSources(
  streamingUrl: string | null | undefined,
  pageUrl: string | null | undefined,
): VideoJsSource[] {
  if (streamingUrl) {
    // HLS
    if (streamingUrl.includes(".m3u8")) {
      return [{ src: streamingUrl, type: "application/x-mpegURL" }]
    }
    // DASH
    if (streamingUrl.includes(".mpd")) {
      return [{ src: streamingUrl, type: "application/dash+xml" }]
    }
    // MP4 or generic
    return [{ src: streamingUrl, type: "video/mp4" }]
  }

  if (pageUrl && /youtube\.com|youtu\.be/.test(pageUrl)) {
    return [{ src: pageUrl, type: "video/youtube" }]
  }
  return []
}
