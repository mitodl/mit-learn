import type { VideoJsSource } from "./VideoJsPlayer"

/**
 * Extract the YouTube video ID from a youtube.com/watch or youtu.be URL.
 * Returns null if the URL is not a recognised YouTube URL.
 */
export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

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
  youtubeId: string | null | undefined,
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

  if (youtubeId) {
    return [
      {
        src: `https://www.youtube.com/watch?v=${youtubeId}`,
        type: "video/youtube",
      },
    ]
  }

  if (pageUrl && /youtube\.com|youtu\.be/.test(pageUrl)) {
    return [{ src: pageUrl, type: "video/youtube" }]
  }
  return []
}
