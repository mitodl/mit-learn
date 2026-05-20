import React from "react"
import { setMockResponse, urls, factories } from "api/test-utils"
import { renderWithProviders, screen } from "@/test-utils"
import VideoSeriesDetailPage from "./VideoSeriesDetailPage"
import { ResourceTypeEnum } from "api/v1"
import type { VideoResource, VideoPlaylistResource } from "api/v1"

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

const makePlaylist = (
  overrides: Partial<VideoPlaylistResource> = {},
): VideoPlaylistResource =>
  factories.learningResources.videoPlaylist(overrides) as VideoPlaylistResource

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
    <VideoSeriesDetailPage
      videoId={video.id}
      playlistId={playlistId}
      playlistData={playlistData}
      playlistLoading={playlistLoading}
    />,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("VideoSeriesDetailPage", () => {
  describe("video title and institution label", () => {
    test("renders the video title once data is loaded", async () => {
      const video = makeVideo({ title: "Introduction to Machine Learning" })
      renderPage({ video })

      await screen.findByRole("heading", {
        name: "Introduction to Machine Learning",
      })
    })
  })

  describe("breadcrumbs", () => {
    test("renders a home breadcrumb link", async () => {
      const video = makeVideo()
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })
      const homeLink = screen.getByRole("link", { name: "Home" })
      expect(homeLink).toBeInTheDocument()
    })

    test("includes a playlist breadcrumb when playlistId is provided", async () => {
      const playlist = makePlaylist({ title: "Neural Networks Series" })
      const video = makeVideo()
      renderPage({
        video,
        playlistId: playlist.id,
        playlistData: playlist,
        playlistItems: [video],
      })

      await screen.findByRole("heading", { name: video.title })
      // Both the breadcrumb and the SeriesNavBar link point to the playlist page
      const playlistLinks = screen.getAllByRole("link", {
        name: "Neural Networks Series",
      })
      expect(playlistLinks.length).toBeGreaterThanOrEqual(1)
      expect(playlistLinks[0]).toHaveAttribute(
        "href",
        `/video-playlist/${playlist.id}`,
      )
    })

    test("does not include a playlist breadcrumb when no playlistId", async () => {
      const playlist = makePlaylist({ title: "Neural Networks Series" })
      const video = makeVideo()
      renderPage({ video, playlistData: playlist, playlistId: null })

      await screen.findByRole("heading", { name: video.title })
      expect(
        screen.queryByRole("link", { name: "Neural Networks Series" }),
      ).not.toBeInTheDocument()
    })
  })

  describe("series nav bar", () => {
    test("renders the series nav bar when playlistId is provided", async () => {
      const playlist = makePlaylist({ title: "Intro to AI" })
      const video = makeVideo()
      renderPage({
        video,
        playlistId: playlist.id,
        playlistData: playlist,
        playlistItems: [video],
      })

      await screen.findByRole("link", { name: "Intro to AI" })
    })

    test("does not render the series nav bar when no playlistId", async () => {
      const playlist = makePlaylist({ title: "Intro to AI" })
      const video = makeVideo()
      renderPage({ video, playlistData: playlist, playlistId: null })

      await screen.findByRole("heading", { name: video.title })
      expect(
        screen.queryByRole("link", { name: "Intro to AI" }),
      ).not.toBeInTheDocument()
    })

    test("renders video position label when part of a playlist", async () => {
      const playlist = makePlaylist({ title: "ML Basics" })
      const [first, second, third] = [
        makeVideo({ title: "Lecture 1" }),
        makeVideo({ title: "Lecture 2" }),
        makeVideo({ title: "Lecture 3" }),
      ]
      renderPage({
        video: second,
        playlistId: playlist.id,
        playlistData: playlist,
        playlistItems: [first, second, third],
      })

      await screen.findByText("Video 2 of 3")
    })

    test("renders a Previous link pointing to the prev video", async () => {
      const playlist = makePlaylist()
      const prev = makeVideo({ title: "Part 1" })
      const current = makeVideo({ title: "Part 2" })
      renderPage({
        video: current,
        playlistId: playlist.id,
        playlistData: playlist,
        playlistItems: [prev, current],
      })

      const prevLink = await screen.findByRole("link", {
        name: /Previous: Part 1/i,
      })
      expect(prevLink).toHaveAttribute(
        "href",
        `/video/${prev.id}?playlist=${playlist.id}`,
      )
    })

    test("renders a Next link pointing to the next video", async () => {
      const playlist = makePlaylist()
      const current = makeVideo({ title: "Part 1" })
      const next = makeVideo({ title: "Part 2" })
      renderPage({
        video: current,
        playlistId: playlist.id,
        playlistData: playlist,
        playlistItems: [current, next],
      })

      const nextLink = await screen.findByRole("link", {
        name: /Next: Part 2/i,
      })
      expect(nextLink).toHaveAttribute(
        "href",
        `/video/${next.id}?playlist=${playlist.id}`,
      )
    })

    test("does not render a Previous link for the first video in a playlist", async () => {
      const playlist = makePlaylist()
      const first = makeVideo({ title: "First Video" })
      const second = makeVideo()
      renderPage({
        video: first,
        playlistId: playlist.id,
        playlistData: playlist,
        playlistItems: [first, second],
      })

      await screen.findByText(/Video 1 of 2/)
      expect(
        screen.queryByRole("link", { name: /Previous/i }),
      ).not.toBeInTheDocument()
    })

    test("does not render a Next link for the last video in a playlist", async () => {
      const playlist = makePlaylist()
      const first = makeVideo()
      const last = makeVideo({ title: "Last Video" })
      renderPage({
        video: last,
        playlistId: playlist.id,
        playlistData: playlist,
        playlistItems: [first, last],
      })

      await screen.findByText(/Video 2 of 2/)
      expect(
        screen.queryByRole("link", { name: /Next/i }),
      ).not.toBeInTheDocument()
    })
  })

  describe("Up Next section", () => {
    test("renders Up Next with a Continue button when there is a next video", async () => {
      const playlist = makePlaylist()
      const current = makeVideo({ title: "Episode 1" })
      const next = makeVideo({ title: "Episode 2" })
      renderPage({
        video: current,
        playlistId: playlist.id,
        playlistData: playlist,
        playlistItems: [current, next],
      })

      await screen.findByText("Up Next")
      expect(screen.getByText("Episode 2")).toBeInTheDocument()
      expect(
        screen.getByRole("link", { name: /Continue/i }),
      ).toBeInTheDocument()
    })

    test("does not render Up Next section when the current video is the last", async () => {
      const playlist = makePlaylist()
      const first = makeVideo()
      const last = makeVideo({ title: "Final Episode" })
      renderPage({
        video: last,
        playlistId: playlist.id,
        playlistData: playlist,
        playlistItems: [first, last],
      })

      await screen.findByRole("heading", { name: last.title })
      expect(screen.queryByText("Up Next")).not.toBeInTheDocument()
    })

    test("does not render Up Next section when there is no playlist", async () => {
      const video = makeVideo()
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })
      expect(screen.queryByText("Up Next")).not.toBeInTheDocument()
    })
  })

  describe("description", () => {
    test("renders the video description when present", async () => {
      const video = makeVideo({
        description: "A deep dive into transformer architecture.",
      })
      renderPage({ video })

      await screen.findByText("A deep dive into transformer architecture.")
    })

    test("renders an accessible description placeholder when description is absent", async () => {
      const video = makeVideo({ description: "", title: "My Video" })
      renderPage({ video })

      await screen.findByRole("heading", { name: "My Video" })
      // When description is absent the component renders a screen-reader-only
      // element in its place so aria-describedby still resolves
      const descEl = document.getElementById("video-description")
      expect(descEl).toBeInTheDocument()
      expect(descEl?.textContent).toContain("My Video")
    })
  })

  describe("video player", () => {
    test("renders VideoJsPlayer when a non-YouTube streaming URL is present", async () => {
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

    test("renders a fallback image when there is no video source but an image exists", async () => {
      const video = makeVideo({
        video: {
          id: 1,
          caption_urls: [],
          streaming_url: null,
          duration: "",
          cover_image_url: null,
        },
        url: null,
        image: factories.learningResources.image({
          url: "https://example.com/thumb.jpg",
          alt: "thumbnail",
          description: "",
        }),
      })
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })
      const img = await screen.findByAltText(/Video thumbnail for/)
      expect(img).toBeInTheDocument()
    })

    test("renders 'No playable source' message when there is no source and no image", async () => {
      const video = makeVideo({
        video: {
          id: 1,
          caption_urls: [],
          streaming_url: null,
          duration: "",
          cover_image_url: null,
        },
        url: null,
        image: null,
      })
      renderPage({ video })

      // The visible NoVideoMessage div should be present
      await screen.findByRole("alert")
      const alert = screen.getByRole("alert")
      expect(alert).toHaveTextContent(
        "No playable source available for this video.",
      )
    })

    test("passes caption_urls as tracks prop to VideoJsPlayer", async () => {
      const captionUrls = [
        { language: "en", language_name: "English", url: "/captions/en.vtt" },
      ]
      const video = makeVideo({
        video: {
          id: 1,
          caption_urls: captionUrls,
          streaming_url: "https://www.youtube.com/watch?v=abc123",
          duration: "",
          cover_image_url: null,
        },
      })
      renderPage({ video })

      const player = await screen.findByTestId("video-js-player")
      const tracks = JSON.parse(player.getAttribute("data-tracks") ?? "[]")
      expect(tracks).toHaveLength(1)
      expect(tracks[0].language).toBe("en")
      expect(tracks[0].url).toBe("/captions/en.vtt")
    })
  })

  describe("loading state", () => {
    test("shows a loading status message while video data is loading", async () => {
      const video = makeVideo()
      // Mock the API but use an unresolved promise to keep the query in loading
      setMockResponse.get(
        urls.learningResources.details({ id: video.id }),
        new Promise(() => {}), // never resolves → stays loading
      )

      renderWithProviders(
        <VideoSeriesDetailPage
          videoId={video.id}
          playlistId={null}
          playlistLoading={false}
        />,
      )

      // The ScreenReaderOnly status span should show the loading message
      const statusEl = document.querySelector(
        "[role='status'][aria-atomic='true']",
      )
      expect(statusEl).toHaveTextContent("Loading video details and player")
    })

    test("shows loaded status message once data arrives", async () => {
      const video = makeVideo()
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })
      const statusEl = document.querySelector(
        "[role='status'][aria-atomic='true']",
      )
      expect(statusEl).toHaveTextContent("Video details loaded")
    })
  })

  describe("skip links", () => {
    test("renders skip-to-main-content and skip-to-player links", async () => {
      const video = makeVideo()
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })
      expect(
        screen.getByRole("link", { name: "Skip to main content" }),
      ).toHaveAttribute("href", "#video-detail-main")
      expect(
        screen.getByRole("link", { name: "Skip to video player" }),
      ).toHaveAttribute("href", "#video-player-region")
    })
  })

  describe("JSON-LD structured data", () => {
    test("renders an application/ld+json script tag with VideoObject data", async () => {
      const video = makeVideo({
        title: "Deep Learning Lecture",
        description: "An intro to deep learning.",
        last_modified: "2024-01-15T00:00:00Z",
        video: {
          id: 1,
          caption_urls: [],
          streaming_url: "https://www.youtube.com/watch?v=abc123",
          duration: "PT1H30M",
          cover_image_url: null,
        },
      })
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })

      const script = document.querySelector(
        "script[type='application/ld+json']",
      )
      expect(script).toBeInTheDocument()
      const data = JSON.parse(script!.textContent ?? "{}")
      expect(data["@type"]).toBe("VideoObject")
      expect(data.name).toBe("Deep Learning Lecture")
      expect(data.description).toBe("An intro to deep learning.")
      expect(data.duration).toBe("PT1H30M")
    })

    test("omits duration from JSON-LD when it is not ISO-8601", async () => {
      const video = makeVideo({
        last_modified: "2024-01-15T00:00:00Z",
        video: {
          id: 1,
          caption_urls: [],
          streaming_url: "https://www.youtube.com/watch?v=abc123",
          duration: "120", // plain seconds — not ISO-8601
          cover_image_url: null,
        },
      })
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })

      const script = document.querySelector(
        "script[type='application/ld+json']",
      )
      const data = JSON.parse(script!.textContent ?? "{}")
      expect(data.duration).toBeUndefined()
    })

    test("includes accessibilityFeature captions in JSON-LD when caption_urls is non-empty", async () => {
      const captionUrls = [
        { language: "en", language_name: "English", url: "/captions/en.vtt" },
      ]
      const video = makeVideo({
        last_modified: "2024-01-15T00:00:00Z",
        video: {
          id: 1,
          caption_urls: captionUrls,
          streaming_url: "https://www.youtube.com/watch?v=abc123",
          duration: "PT10M",
          cover_image_url: null,
        },
      })
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })

      const script = document.querySelector(
        "script[type='application/ld+json']",
      )
      const data = JSON.parse(script!.textContent ?? "{}")
      expect(data.accessibilityFeature).toContain("captions")
    })

    test("omits accessibilityFeature from JSON-LD when caption_urls is empty", async () => {
      const video = makeVideo({
        last_modified: "2024-01-15T00:00:00Z",
        video: {
          id: 1,
          caption_urls: [],
          streaming_url: "https://www.youtube.com/watch?v=abc123",
          duration: "PT10M",
          cover_image_url: null,
        },
      })
      renderPage({ video })

      await screen.findByRole("heading", { name: video.title })

      const script = document.querySelector(
        "script[type='application/ld+json']",
      )
      const data = JSON.parse(script!.textContent ?? "{}")
      expect(data.accessibilityFeature).toBeUndefined()
    })
  })
})
