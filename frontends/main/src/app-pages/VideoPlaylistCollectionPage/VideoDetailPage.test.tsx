import React from "react"
import { setMockResponse, urls, factories } from "api/test-utils"
import { renderWithProviders, screen } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import VideoDetailPage from "./VideoDetailPage"
import { ResourceTypeEnum } from "api/v1"
import type { VideoResource, VideoPlaylistResource } from "api/v1"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({}),
}))

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

// ── Factories ────────────────────────────────────────────────────────────────

const makeVideo = (overrides: Partial<VideoResource> = {}): VideoResource =>
  factories.learningResources.video({
    resource_type: ResourceTypeEnum.Video,
    ...overrides,
  }) as VideoResource

// ── API helpers ───────────────────────────────────────────────────────────────

const setupVideoApi = (video: VideoResource) => {
  setMockResponse.get(urls.learningResources.details({ id: video.id }), video)
}

const setupItemsApi = (playlistId: number, items: VideoResource[]) => {
  setMockResponse.get(urls.learningResources.items({ id: playlistId }), {
    count: items.length,
    next: null,
    previous: null,
    results: items.map((item, i) => ({
      id: i + 1,
      child: item.id,
      parent: playlistId,
      position: i + 1,
      resource: item,
    })),
  })
}

// ── Default render helper ────────────────────────────────────────────────────

type RenderOptions = {
  video?: VideoResource
  playlistId?: number | null
  playlistData?: VideoPlaylistResource
  playlistLoading?: boolean
  playlistItems?: VideoResource[]
}

const renderPage = ({
  video = makeVideo(),
  playlistId = null,
  playlistData = undefined,
  playlistLoading = false,
  playlistItems = [],
}: RenderOptions = {}) => {
  setupVideoApi(video)
  if (playlistId) {
    setupItemsApi(playlistId, playlistItems)
  }

  return renderWithProviders(
    <VideoDetailPage
      videoId={video.id}
      playlistId={playlistId}
      playlistData={playlistData}
      playlistLoading={playlistLoading}
    />,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("VideoDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // VideoDetailPage renders when the flag is enabled
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
  })

  describe("video player", () => {
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
      renderPage({ video })

      await screen.findByTestId("video-js-player")
      expect(
        screen.queryByTitle(/YouTube video player/i),
      ).not.toBeInTheDocument()
    })

    test("renders a YouTube iframe (not VideoJsPlayer) for a YouTube video", async () => {
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
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })
      const iframe = screen.getByTitle("Video: My YouTube Video")
      expect(iframe.tagName).toBe("IFRAME")
      expect(iframe).toHaveAttribute(
        "src",
        expect.stringContaining("youtube.com/embed/dQw4w9WgXcQ"),
      )
      expect(iframe).toHaveAttribute("aria-describedby", "video-description")
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
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })
      const iframe = screen.getByTitle("Video: Lecture on AI")
      expect(iframe).toHaveAttribute("src", expect.stringContaining("rel=0"))
    })

    test("falls back to VideoJsPlayer when YouTube video ID cannot be extracted", async () => {
      // pageUrl produces video/youtube source type but the ID is too short to parse
      const video = makeVideo({
        video: {
          id: 1,
          caption_urls: [],
          streaming_url: null,
          duration: "",
          cover_image_url: null,
        },
        url: "https://www.youtube.com/watch?v=SHORT", // < 11 chars
        content_files: [],
      })
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })
      await screen.findByTestId("video-js-player")
      expect(
        screen.queryByTitle(/YouTube video player/i),
      ).not.toBeInTheDocument()
    })
  })
})
