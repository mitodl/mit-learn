import React from "react"
import user from "@testing-library/user-event"
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

  // Share URL is the slugged canonical form, and carries the playlist only
  // when present (no `?playlist=null` when the video is viewed without one).
  test.each([
    {
      playlistId: 99,
      expected:
        "http://test.learn.odl.local:8062/video/720/intro-to-machine-learning?playlist=99",
    },
    {
      playlistId: null,
      expected:
        "http://test.learn.odl.local:8062/video/720/intro-to-machine-learning",
    },
  ])(
    "Share link is the slugged canonical URL (playlistId=$playlistId)",
    async ({ playlistId, expected }) => {
      const video = makeVideo({ id: 720, title: "Intro to Machine Learning" })
      renderPage({ video, playlistId })

      await screen.findByRole("heading", { name: video.title })
      await user.click(screen.getByRole("button", { name: /share/i }))

      expect(screen.getByRole("textbox")).toHaveValue(expected)
    },
  )

  describe("share button", () => {
    test("is not shown while data is still loading", async () => {
      const video = makeVideo({ title: "Loading Test" })
      renderPage({ video })
      // Synchronously after render the API hasn't resolved yet
      expect(
        screen.queryByRole("button", { name: /share/i }),
      ).not.toBeInTheDocument()
      // Confirm it does appear once loaded (proving the above was the loading state)
      await screen.findByRole("button", { name: /share loading test/i })
    })

    test("aria-label includes the video title", async () => {
      const video = makeVideo({ title: "Quantum Computing" })
      renderPage({ video })
      expect(
        await screen.findByRole("button", { name: /share quantum computing/i }),
      ).toBeInTheDocument()
    })

    test("clicking the button opens the share dialog", async () => {
      const video = makeVideo({ title: "Open Dialog Test" })
      renderPage({ video })
      await user.click(
        await screen.findByRole("button", { name: /share open dialog test/i }),
      )
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    test("closing the dialog removes it from the page", async () => {
      const video = makeVideo({ title: "Close Dialog Test" })
      renderPage({ video })
      await user.click(
        await screen.findByRole("button", { name: /share close dialog test/i }),
      )
      await user.click(screen.getByRole("button", { name: /^close$/i }))
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
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
