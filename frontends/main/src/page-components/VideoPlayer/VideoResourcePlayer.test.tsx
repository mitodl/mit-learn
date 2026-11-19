import React from "react"
import { factories } from "api/test-utils"
import { act, renderWithProviders, screen } from "@/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { VideoResource } from "api/v1"
import VideoResourcePlayer from "./VideoResourcePlayer"

// Stub VideoJsPlayer to avoid loading video.js in the test environment.
// The latest onVideoDimensions is kept so tests can play the part of video.js
// reporting the stream's size.
let reportDimensions: ((width: number, height: number) => void) | undefined
jest.mock("./VideoJsPlayer", () => ({
  __esModule: true,
  default: (props: {
    ariaLabel?: string
    tracks?: { language: string; language_name: string; url: string }[]
    onVideoDimensions?: (width: number, height: number) => void
  }) => {
    reportDimensions = props.onVideoDimensions
    return (
      <div
        data-testid="video-js-player"
        aria-label={props.ariaLabel}
        data-tracks={JSON.stringify(props.tracks ?? [])}
      />
    )
  },
}))

const makeVideo = (overrides: Partial<VideoResource> = {}): VideoResource =>
  factories.learningResources.video({
    resource_type: ResourceTypeEnum.Video,
    ...overrides,
  }) as VideoResource

const playerFor = (video: VideoResource) => (
  <VideoResourcePlayer
    video={video}
    videoId={video.id}
    isLoading={false}
    videoTitleLabel={video.title ?? "Test video"}
    videoThumbnailAlt="Video thumbnail"
  />
)

const renderPlayer = (video: VideoResource) =>
  renderWithProviders(playerFor(video))

const makeStreamingVideo = () =>
  makeVideo({
    video: {
      id: 1,
      caption_urls: [],
      streaming_url: "https://cdn.example.com/video/index.m3u8",
      duration: "120",
      cover_image_url: null,
    },
  })

const playerRegion = () => screen.getByRole("region", { name: /Video player/ })

/**
 * The emotion CSS rules attached to the player region's own classes.
 * happy-dom doesn't compute aspect-ratio or min()/max() widths, but the rules
 * emotion inserts can be read back.
 */
const playerRules = () => {
  const rules = [...document.querySelectorAll("style")].flatMap((style) =>
    [...(style.sheet?.cssRules ?? [])].map((rule) => rule.cssText),
  )
  const classes = playerRegion().className.split(" ")
  return {
    own: classes.flatMap((cls) =>
      rules.filter((rule) => rule.startsWith(`.${cls} {`)),
    ),
    nested: classes.flatMap((cls) =>
      rules.filter((rule) => rule.startsWith(`.${cls} `)),
    ),
  }
}

describe("VideoResourcePlayer", () => {
  test("renders VideoJsPlayer for a non-YouTube streaming URL", async () => {
    const video = makeVideo({
      video: {
        id: 1,
        caption_urls: [],
        streaming_url: "https://cdn.example.com/video/index.m3u8",
        duration: "120",
        cover_image_url: null,
      },
    })
    renderPlayer(video)

    await screen.findByTestId("video-js-player")
    expect(screen.queryByTitle(/YouTube video player/i)).not.toBeInTheDocument()
  })

  test("renders a YouTube iframe for a YouTube video", async () => {
    const video = makeVideo({
      title: "My YouTube Video",
      video: {
        id: 1,
        caption_urls: [],
        streaming_url: null,
        duration: "120",
        cover_image_url: null,
      },
      url: null,
      content_files: [
        factories.learningResources.contentFile({
          youtube_id: "dQw4w9WgXcQ",
        }),
      ],
    })
    renderPlayer(video)

    const iframe = await screen.findByTitle("Video: My YouTube Video")
    expect(iframe.tagName).toBe("IFRAME")
    expect(iframe).toHaveAttribute(
      "src",
      expect.stringContaining("youtube.com/embed/dQw4w9WgXcQ"),
    )
    expect(screen.queryByTestId("video-js-player")).not.toBeInTheDocument()
  })

  test("YouTube iframe has rel=0 in the src to suppress related videos", async () => {
    const video = makeVideo({
      title: "Lecture on AI",
      video: {
        id: 1,
        caption_urls: [],
        streaming_url: null,
        duration: "",
        cover_image_url: null,
      },
      url: null,
      content_files: [
        factories.learningResources.contentFile({
          youtube_id: "abcdefghijk",
        }),
      ],
    })
    renderPlayer(video)

    const iframe = await screen.findByTitle("Video: Lecture on AI")
    expect(iframe).toHaveAttribute("src", expect.stringContaining("rel=0"))
  })

  test("renders VideoJsPlayer for a youtube.com page URL when no youtube_id", async () => {
    const video = makeVideo({
      video: {
        id: 1,
        caption_urls: [],
        streaming_url: null,
        duration: "",
        cover_image_url: null,
      },
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      content_files: [],
    })
    renderPlayer(video)

    // convertToEmbedUrl converts this to an embed URL -> iframe is shown
    const iframe = await screen.findByTitle(/^Video:/)
    expect(iframe.tagName).toBe("IFRAME")
    expect(iframe).toHaveAttribute(
      "src",
      expect.stringContaining("youtube.com/embed/dQw4w9WgXcQ"),
    )
  })

  test("shows no-source message when video has no sources or thumbnail", async () => {
    const video = makeVideo({
      video: {
        id: 1,
        caption_urls: [],
        streaming_url: null,
        duration: "",
        cover_image_url: null,
      },
      url: "https://example.com/not-a-video",
      image: null,
      content_files: [],
    })
    renderPlayer(video)

    expect(
      (
        await screen.findAllByText(
          "No playable source available for this video.",
        )
      ).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByTestId("video-js-player")).not.toBeInTheDocument()
    expect(screen.queryByTitle(/YouTube video player/i)).not.toBeInTheDocument()
  })

  test("shows loading skeleton while isLoading is true", () => {
    const video = makeVideo()
    renderWithProviders(
      <VideoResourcePlayer
        video={video}
        videoId={video.id}
        isLoading={true}
        videoTitleLabel="Test video"
        videoThumbnailAlt="Video thumbnail"
      />,
    )

    expect(screen.getByLabelText("Loading video player")).toBeInTheDocument()
    expect(screen.queryByTestId("video-js-player")).not.toBeInTheDocument()
  })

  describe("sizing to the video", () => {
    // happy-dom doesn't compute aspect-ratio or min() widths, so these check
    // the ratio the player is sized to rather than the resulting CSS.
    const sizedTo = () => playerRegion().getAttribute("data-video-aspect-ratio")

    beforeEach(() => {
      reportDimensions = undefined
    })

    test("stays at the default 16:9 until the video reports its size", async () => {
      renderPlayer(makeStreamingVideo())
      await screen.findByTestId("video-js-player")
      expect(sizedTo()).toBeNull()
    })

    test("takes a vertical video's shape once it reports", async () => {
      renderPlayer(makeStreamingVideo())
      await screen.findByTestId("video-js-player")
      const before = playerRegion().className
      act(() => reportDimensions!(540, 960))
      expect(sizedTo()).toBe(String(540 / 960))
      // The new size comes from a class, not an inline style, so pages that
      // size the player themselves can still override it.
      expect(playerRegion().className).not.toBe(before)
      expect(playerRegion()).not.toHaveAttribute("style")
    })

    test("takes a landscape video's own ratio", async () => {
      renderPlayer(makeStreamingVideo())
      await screen.findByTestId("video-js-player")
      act(() => reportDimensions!(1440, 1080))
      expect(sizedTo()).toBe(String(1440 / 1080))
    })

    test("goes back to 16:9 for the next video until it reports", async () => {
      const first = makeStreamingVideo()
      const { view } = renderPlayer(first)
      await screen.findByTestId("video-js-player")
      act(() => reportDimensions!(540, 960))
      expect(sizedTo()).not.toBeNull()

      view.rerender(playerFor({ ...makeStreamingVideo(), id: first.id + 1 }))
      await screen.findByTestId("video-js-player")
      expect(sizedTo()).toBeNull()
    })

    test("keeps the progress bar on narrow players", async () => {
      renderPlayer(makeStreamingVideo())
      await screen.findByTestId("video-js-player")
      // video.js hides the progress bar at its "x-small" layout (≤320px wide),
      // which a height-capped vertical video often is. The rules that undo
      // that must be scoped to this player's class.
      expect(playerRules().nested).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /\.video-js\.vjs-layout-x-small \.vjs-progress-control \{\s*display: flex;/,
          ),
          expect.stringMatching(
            /\.video-js\.vjs-layout-x-small \.vjs-custom-control-spacer \{\s*display: none;/,
          ),
        ]),
      )
    })

    test("caps a portrait player's height, with a minimum width", async () => {
      renderPlayer(makeStreamingVideo())
      await screen.findByTestId("video-js-player")
      act(() => reportDimensions!(540, 960))
      const own = playerRules().own.join("\n")
      expect(own).toMatch(/aspect-ratio: 0\.5625/)
      // At most 80vh tall, but never narrow enough for video.js's "tiny"
      // layout, which drops the progress bar.
      expect(own).toMatch(
        /width: min\(100%, max\(240px, calc\(80vh \* 0\.5625\)\)\)/,
      )
      expect(own).toMatch(/margin-inline: auto/)
    })

    test("keeps a landscape player full width", async () => {
      renderPlayer(makeStreamingVideo())
      await screen.findByTestId("video-js-player")
      act(() => reportDimensions!(1440, 1080))
      const own = playerRules().own.join("\n")
      expect(own).toMatch(new RegExp(`aspect-ratio: ${1440 / 1080}`))
      expect(own).not.toMatch(/80vh/)
      expect(own).not.toMatch(/margin-inline/)
    })

    test("YouTube videos stay 16:9", async () => {
      renderPlayer(
        makeVideo({
          video: {
            id: 1,
            caption_urls: [],
            streaming_url: null,
            duration: "120",
            cover_image_url: null,
          },
          url: null,
          content_files: [
            factories.learningResources.contentFile({
              youtube_id: "dQw4w9WgXcQ",
            }),
          ],
        }),
      )
      await screen.findByTitle(/^Video: /)
      expect(reportDimensions).toBeUndefined()
      expect(sizedTo()).toBeNull()
    })
  })
})
