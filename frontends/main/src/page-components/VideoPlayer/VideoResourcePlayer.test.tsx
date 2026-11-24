import React from "react"
import { factories } from "api/test-utils"
import { act, renderWithProviders, screen } from "@/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { VideoResource } from "api/v1"
import { VIDEO_SHORT_CATEGORY } from "@/common/constants"
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

const makeStreamingVideo = (overrides: Partial<VideoResource> = {}) =>
  makeVideo({
    ...overrides,
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
    /** The player's own rules, joined, e.g. to match its aspect-ratio. */
    const ownRules = () => playerRules().own.join("\n")
    const aspectRatio = () => ownRules().match(/aspect-ratio: ([^;]+);/)?.[1]
    const PORTRAIT_WIDTH =
      /width: min\(100%, max\(240px, calc\(80vh \* 0\.5625\)\)\)/

    beforeEach(() => {
      reportDimensions = undefined
    })

    test("starts at 16:9 until the video reports its size", async () => {
      renderPlayer(makeStreamingVideo())
      await screen.findByTestId("video-js-player")
      expect(aspectRatio()).toBe("16/9")
      expect(ownRules()).not.toMatch(/80vh/)
    })

    test("starts a video short at 9:16, height-capped, before it reports", async () => {
      renderPlayer(
        makeStreamingVideo({ resource_category: VIDEO_SHORT_CATEGORY }),
      )
      await screen.findByTestId("video-js-player")
      expect(reportDimensions).toBeDefined()
      expect(aspectRatio()).toBe("0.5625")
      expect(ownRules()).toMatch(PORTRAIT_WIDTH)
    })

    test("a video short that reports landscape takes the reported shape", async () => {
      renderPlayer(
        makeStreamingVideo({ resource_category: VIDEO_SHORT_CATEGORY }),
      )
      await screen.findByTestId("video-js-player")
      act(() => reportDimensions!(1920, 1080))
      expect(aspectRatio()).toBe(String(1920 / 1080))
      expect(ownRules()).not.toMatch(/80vh/)
    })

    test("caps a reported portrait player's height, with a minimum width", async () => {
      renderPlayer(makeStreamingVideo())
      await screen.findByTestId("video-js-player")
      act(() => reportDimensions!(540, 960))
      expect(aspectRatio()).toBe("0.5625")
      // At most 80vh tall, but never narrow enough for video.js's "tiny"
      // layout, which drops the progress bar.
      expect(ownRules()).toMatch(PORTRAIT_WIDTH)
      expect(ownRules()).toMatch(/margin-inline: auto/)
      // The size comes from a class, not an inline style, so pages that size
      // the player themselves can still override it.
      expect(playerRegion()).not.toHaveAttribute("style")
    })

    test("keeps a reported landscape player full width at its own ratio", async () => {
      renderPlayer(makeStreamingVideo())
      await screen.findByTestId("video-js-player")
      act(() => reportDimensions!(1440, 1080))
      expect(aspectRatio()).toBe(String(1440 / 1080))
      expect(ownRules()).not.toMatch(/80vh/)
      expect(ownRules()).not.toMatch(/margin-inline/)
    })

    test("goes back to the expected shape for the next video until it reports", async () => {
      const first = makeStreamingVideo()
      const { view } = renderPlayer(first)
      await screen.findByTestId("video-js-player")
      act(() => reportDimensions!(540, 960))
      expect(aspectRatio()).toBe("0.5625")

      view.rerender(playerFor({ ...makeStreamingVideo(), id: first.id + 1 }))
      await screen.findByTestId("video-js-player")
      expect(aspectRatio()).toBe("16/9")
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
      expect(aspectRatio()).toBe("16/9")
    })
  })
})
