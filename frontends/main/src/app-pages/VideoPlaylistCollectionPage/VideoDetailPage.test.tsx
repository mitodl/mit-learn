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

  test("renders the video title once data is loaded", async () => {
    const video = makeVideo({ title: "Introduction to Machine Learning" })
    renderPage({ video })

    await screen.findByRole("heading", {
      name: "Introduction to Machine Learning",
    })
  })

  test("renders VideoResourcePlayer for the video", async () => {
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
  })
})
