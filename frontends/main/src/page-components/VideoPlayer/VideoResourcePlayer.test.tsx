import React from "react"
import { factories } from "api/test-utils"
import { renderWithProviders, screen } from "@/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { VideoResource } from "api/v1"
import VideoResourcePlayer from "./VideoResourcePlayer"

// Stub VideoJsPlayer to avoid loading video.js in the test environment
jest.mock("./VideoJsPlayer", () => ({
  __esModule: true,
  default: (props: {
    ariaLabel?: string
    tracks?: { language: string; language_name: string; url: string }[]
  }) => (
    <div
      data-testid="video-js-player"
      aria-label={props.ariaLabel}
      data-tracks={JSON.stringify(props.tracks ?? [])}
    />
  ),
}))

const makeVideo = (overrides: Partial<VideoResource> = {}): VideoResource =>
  factories.learningResources.video({
    resource_type: ResourceTypeEnum.Video,
    ...overrides,
  }) as VideoResource

const renderPlayer = (video: VideoResource) =>
  renderWithProviders(
    <VideoResourcePlayer
      video={video}
      videoId={video.id}
      isLoading={false}
      videoTitleLabel={video.title ?? "Test video"}
      videoThumbnailAlt="Video thumbnail"
    />,
  )

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
})
