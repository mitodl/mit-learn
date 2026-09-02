import { resolveVideoSources } from "./videoSources"

describe("resolveVideoSources", () => {
  it("returns HLS source for .m3u8 streaming URL", () => {
    const result = resolveVideoSources(
      "https://cdn.example.com/video/index.m3u8",
      null,
      null,
    )
    expect(result).toEqual([
      {
        src: "https://cdn.example.com/video/index.m3u8",
        type: "application/x-mpegURL",
      },
    ])
  })

  it("returns DASH source for .mpd streaming URL", () => {
    const result = resolveVideoSources(
      "https://cdn.example.com/video/manifest.mpd",
      null,
      null,
    )
    expect(result).toEqual([
      {
        src: "https://cdn.example.com/video/manifest.mpd",
        type: "application/dash+xml",
      },
    ])
  })

  it("returns MP4 source for a generic streaming URL", () => {
    const result = resolveVideoSources(
      "https://cdn.example.com/video/clip.mp4",
      null,
      null,
    )
    expect(result).toEqual([
      { src: "https://cdn.example.com/video/clip.mp4", type: "video/mp4" },
    ])
  })

  it("returns MP4 source for a streaming URL with no recognised extension", () => {
    const result = resolveVideoSources(
      "https://cdn.example.com/video/stream",
      "https://www.youtube.com/watch?v=abc",
      null,
    )
    // streamingUrl takes precedence over pageUrl
    expect(result).toEqual([
      { src: "https://cdn.example.com/video/stream", type: "video/mp4" },
    ])
  })

  it("returns YouTube source when no streaming URL and pageUrl is a youtube.com link", () => {
    const result = resolveVideoSources(
      null,
      "https://www.youtube.com/watch?v=abc123",
      null,
    )
    expect(result).toEqual([
      { src: "https://www.youtube.com/watch?v=abc123", type: "video/youtube" },
    ])
  })

  it("returns YouTube source when pageUrl is a youtu.be short link", () => {
    const result = resolveVideoSources(null, "https://youtu.be/abc123", null)
    expect(result).toEqual([
      { src: "https://youtu.be/abc123", type: "video/youtube" },
    ])
  })

  it("returns YouTube source from youtubeId when no streaming URL", () => {
    const result = resolveVideoSources(null, null, "dQw4w9WgXcQ")
    expect(result).toEqual([
      {
        src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        type: "video/youtube",
      },
    ])
  })

  it("prefers youtubeId over a non-YouTube pageUrl", () => {
    const result = resolveVideoSources(
      null,
      "https://ocw.mit.edu/some-video",
      "dQw4w9WgXcQ",
    )
    expect(result).toEqual([
      {
        src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        type: "video/youtube",
      },
    ])
  })

  it("returns an empty array when all arguments are null", () => {
    expect(resolveVideoSources(null, null, null)).toEqual([])
  })

  it("returns an empty array when all arguments are undefined", () => {
    expect(resolveVideoSources(undefined, undefined, undefined)).toEqual([])
  })

  it("returns an empty array when there is no streaming URL, no youtubeId, and pageUrl is not a YouTube link", () => {
    expect(
      resolveVideoSources(null, "https://ocw.mit.edu/some-video", null),
    ).toEqual([])
  })
})
