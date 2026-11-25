import React from "react"
import user from "@testing-library/user-event"
import { setMockResponse, urls, factories } from "api/test-utils"
import { absoluteUrl, videoDetailPath } from "@/common/urls"
import { renderWithProviders, screen, within } from "@/test-utils"
import { useFeatureFlag } from "@/common/useFeatureFlag"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import VideoDetailPage from "./VideoDetailPage"
import { ResourceTypeEnum } from "api/v1"
import type { VideoResource, VideoPlaylistResource } from "api/v1"
import { VIDEO_SHORT_CATEGORY } from "@/common/constants"

jest.mock("@/common/useFeatureFlag")
const mockedUseFeatureFlag = jest.mocked(useFeatureFlag)
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({}),
}))

// Stub VideoJsPlayer to avoid loading video.js in the test environment
jest.mock("@/page-components/VideoPlayer/VideoJsPlayer", () => ({
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
    mockedUseFeatureFlag.mockReturnValue(true)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
  })

  test("'more from this playlist' rows keep the browsed playlist and take only the backend slug", async () => {
    const current = makeVideo({ title: "Current Video" })
    const sibling = makeVideo({ title: "Sibling Video" })
    renderPage({
      video: current,
      playlistId: 99,
      playlistItems: [current, sibling],
    })

    const row = await screen.findByRole("link", {
      name: `Open video ${sibling.title}`,
    })
    expect(row).toHaveAttribute(
      "href",
      videoDetailPath(sibling.id, 99, sibling.url_slug),
    )
  })

  test("'more from this playlist' shows shorts as a grid of four cards", async () => {
    const makeShort = () =>
      makeVideo({ resource_category: VIDEO_SHORT_CATEGORY })
    const [current, ...siblings] = Array.from({ length: 7 }, makeShort)
    renderPage({
      video: current,
      playlistId: 99,
      playlistItems: [current, ...siblings],
    })

    await screen.findByText(siblings[0].title)
    const section = document.getElementById("more-from-playlist")!
    const cards = within(section).getAllByRole("listitem")
    expect(cards).toHaveLength(4)
    cards.forEach((card, i) => {
      expect(
        within(card).getByRole("link", {
          name: new RegExp(`^${siblings[i].title}`),
        }),
      ).toHaveAttribute(
        "href",
        videoDetailPath(siblings[i].id, 99, siblings[i].url_slug),
      )
    })
    // The rows used for regular videos aren't shown.
    expect(
      within(section).queryByRole("link", { name: /^Open video / }),
    ).not.toBeInTheDocument()
    // 7 videos: the current one and four cards leave two unseen.
    within(section).getByRole("link", { name: /^View all videos in / })
  })

  test("'more from this playlist' keeps rows when the current video is the playlist's only regular one", async () => {
    const current = makeVideo()
    const shorts = Array.from({ length: 3 }, () =>
      makeVideo({ resource_category: VIDEO_SHORT_CATEGORY }),
    )
    renderPage({
      video: current,
      playlistId: 99,
      playlistItems: [current, ...shorts],
    })

    const section = document.getElementById("more-from-playlist")!
    for (const short of shorts) {
      await within(section).findByRole("link", {
        name: `Open video ${short.title}`,
      })
    }
    expect(within(section).queryAllByRole("listitem")).toHaveLength(0)
  })

  test("a video short shows its description under 'About this video'", async () => {
    const video = makeVideo({
      resource_category: VIDEO_SHORT_CATEGORY,
      description: "<p>How rubber acts like a neuron.</p>",
    })
    renderPage({ video })

    const heading = await screen.findByRole("heading", {
      name: "About this video",
    })
    expect(heading.parentElement).toHaveTextContent(
      "How rubber acts like a neuron.",
    )
    // The description still describes the player.
    expect(
      screen.getByRole("region", { name: /Video player/ }),
    ).toHaveAccessibleDescription("How rubber acts like a neuron.")
  })

  test("a regular video has no 'About this video' heading", async () => {
    const video = makeVideo({ description: "<p>A lecture.</p>" })
    renderPage({ video })

    await screen.findByText("A lecture.")
    expect(
      screen.queryByRole("heading", { name: "About this video" }),
    ).not.toBeInTheDocument()
  })

  test("renders the video title once data is loaded", async () => {
    const video = makeVideo({ title: "Introduction to Machine Learning" })
    renderPage({ video })

    await screen.findByRole("heading", {
      name: "Introduction to Machine Learning",
    })
  })

  // Sharing keeps the playlist the video is being watched in, even when that
  // is not the canonical one: the recommendation is usually about the series.
  // A video watched outside any playlist gets the bare form, not `playlist=null`.
  test.each([{ playlistId: 99 }, { playlistId: null }])(
    "Share link keeps the browsed playlist (playlistId=$playlistId)",
    async ({ playlistId }) => {
      const video = makeVideo({ title: "Intro to Machine Learning" })
      renderPage({ video, playlistId })

      await screen.findByRole("heading", { name: video.title })
      await user.click(screen.getByRole("button", { name: /share/i }))

      expect(screen.getByRole("textbox")).toHaveValue(
        absoluteUrl(
          videoDetailPath(video.id, playlistId ?? undefined, video.url_slug),
        ),
      )
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
