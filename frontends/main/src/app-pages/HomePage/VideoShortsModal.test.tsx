import React from "react"
import VideoShortsModal from "./VideoShortsModal"
import type { VideoResource } from "api/v1"
import { ResourceTypeEnum } from "api/v1"
import { factories } from "api/test-utils"
import { renderWithProviders, screen, user, fireEvent, act } from "@/test-utils"
import type Player from "video.js/dist/types/player"
import { usePostHog } from "posthog-js/react"
import type { PostHog } from "posthog-js"

jest.mock("posthog-js/react")
const mockedPostHogCapture = jest.fn()
jest.mocked(usePostHog).mockReturnValue({
  capture: mockedPostHogCapture,
} as unknown as PostHog)

// Stub VideoJsPlayer to avoid loading video.js in the test environment.
// Captures the onReady callback so tests can simulate the player being ready,
// and renders a plain <video> so existing DOM queries keep working.
type MockPlayerHandle = {
  player: ReturnType<typeof makeMockPlayer>
  triggerReady: () => void
  triggerError: () => void
}

const makeMockPlayer = () => ({
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(),
  paused: jest.fn(() => true),
  ended: jest.fn(() => false),
  currentTime: jest.fn(() => 0),
  readyState: jest.fn(() => 0),
  duration: jest.fn(() => 0),
  muted: jest.fn(() => true),
  loop: jest.fn(),
  on: jest.fn(),
  one: jest.fn(),
  el: jest.fn(() => ({ style: {} })),
  isDisposed: jest.fn(() => false),
  dispose: jest.fn(),
})

const mockHandles: MockPlayerHandle[] = []

jest.mock("@/app-pages/VideoPlaylistCollectionPage/VideoJsPlayer", () => ({
  __esModule: true,
  default: ({
    sources,
    onReady,
  }: {
    sources: { src: string; type: string }[]
    onReady?: (player: Player) => void
  }) => {
    const mockPlayer = makeMockPlayer()

    // Wire up the error handler so tests can fire it
    const handle: MockPlayerHandle = {
      player: mockPlayer,
      triggerReady: () => onReady?.(mockPlayer as unknown as Player),
      triggerError: () => {
        const errorCb = (mockPlayer.on as jest.Mock).mock.calls.find(
          ([event]: [string]) => event === "error",
        )?.[1]
        errorCb?.(new Event("error"))
      },
    }
    mockHandles.push(handle)

    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <video src={sources[0]?.src} />
  },
}))

// CarouselV2Vertical uses Embla scroll APIs unavailable in JSDOM; render
// children directly and expose triggerSlidesInView so tests can simulate
// scroll events on demand (matching Embla's behavior: no fire on initial mount).
let triggerSlidesInView: (inView: number[]) => void = () => {}
jest.mock("ol-components/CarouselV2Vertical", () => ({
  CarouselV2Vertical: ({
    children,
    onSlidesInView,
  }: {
    children: React.ReactNode
    onSlidesInView?: (inView: number[]) => void
    initialSlide?: number
  }) => {
    React.useEffect(() => {
      triggerSlidesInView = (inView) => onSlidesInView?.(inView)
      return () => {
        triggerSlidesInView = () => {}
      }
    }, [onSlidesInView])
    return <div>{children}</div>
  },
}))

const makeVideoResource = (
  overrides: Partial<VideoResource> = {},
): VideoResource =>
  factories.learningResources.video({
    resource_type: ResourceTypeEnum.Video,
    video: {
      id: 1,
      streaming_url: "https://example.com/video.mp4",
      duration: "PT1M",
      caption_urls: [],
      cover_image_url: null,
    },
    ...overrides,
  }) as VideoResource

describe("VideoShortsModal", () => {
  beforeEach(() => {
    mockHandles.length = 0
    mockedPostHogCapture.mockClear()
  })

  const defaultProps = {
    startIndex: 0,
    videoData: [
      makeVideoResource({ title: "First Video" }),
      makeVideoResource({ title: "Second Video" }),
    ],
    onClose: jest.fn(),
  }

  test("renders with video data and displays close and mute buttons", () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    const buttons = screen.getAllByRole("button")
    expect(buttons.length).toBeGreaterThanOrEqual(2)
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  test("calls onClose when close button is clicked", async () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    const buttons = screen.getAllByRole("button")
    const closeButton = buttons[0]
    await user.click(closeButton)

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  test("calls onClose when Escape key is pressed", () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    fireEvent.keyDown(document, { key: "Escape" })

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  test("toggles mute state when mute button is clicked", async () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    const buttons = screen.getAllByRole("button")
    const muteButton = buttons[1]
    await user.click(muteButton)
    await user.click(muteButton)

    expect(buttons[1]).toBeInTheDocument()
  })

  test("renders video elements for nearby slides", () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    const videos = document.querySelectorAll("video")
    expect(videos.length).toBeGreaterThanOrEqual(1)
  })

  test("video element has correct src from streaming_url", () => {
    const videoData = [makeVideoResource({ title: "Test Video" })]

    renderWithProviders(
      <VideoShortsModal
        startIndex={0}
        videoData={videoData}
        onClose={jest.fn()}
      />,
    )

    const video = document.querySelector("video")
    expect(video?.src).toBe("https://example.com/video.mp4")
  })

  test("displays error placeholder when video errors", async () => {
    const videoData = [makeVideoResource({ title: "Error Video" })]
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})

    renderWithProviders(
      <VideoShortsModal
        startIndex={0}
        videoData={videoData}
        onClose={jest.fn()}
      />,
    )

    await act(async () => {
      // Simulate the VideoJsPlayer calling onReady, then firing an error
      mockHandles[0]?.triggerReady()
      mockHandles[0]?.triggerError()
    })

    expect(screen.getByText("Playback errored!")).toBeInTheDocument()
    expect(screen.getByText("Error Video")).toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  test("renders with startIndex to show correct initial video", () => {
    const videoData = [
      makeVideoResource({ title: "First" }),
      makeVideoResource({ title: "Second" }),
      makeVideoResource({ title: "Third" }),
    ]

    renderWithProviders(
      <VideoShortsModal
        startIndex={1}
        videoData={videoData}
        onClose={jest.fn()}
      />,
    )

    const videos = document.querySelectorAll("video")
    expect(videos.length).toBeGreaterThanOrEqual(1)
  })

  test("renders carousel slides for each video", () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    const slides = document.querySelectorAll("[data-index]")
    expect(slides.length).toBe(defaultProps.videoData.length)
  })

  test("overlay has dialog role and aria-modal attributes", () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAttribute("aria-label", "Video Shorts")
  })

  test("close button has aria-label Close", () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
  })

  test("mute button receives focus on open", async () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })

    expect(screen.getByRole("button", { name: "Unmute" })).toHaveFocus()
  })

  test("mute button has correct aria-label reflecting muted state", async () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Unmute" }))

    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument()
  })

  test("play/pause button renders only for the selected slide", () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    // Only one play/pause button should exist — for the selected (first) slide
    const playButtons = screen.getAllByRole("button", { name: /play|pause/i })
    expect(playButtons).toHaveLength(1)
    expect(playButtons[0]).toHaveAttribute("aria-label", "Play")
  })

  test("play/pause button updates aria-label when clicked", async () => {
    const videoData = [makeVideoResource({ title: "Test Video" })]
    renderWithProviders(
      <VideoShortsModal
        startIndex={0}
        videoData={videoData}
        onClose={jest.fn()}
      />,
    )

    await act(async () => {
      mockHandles[0]?.triggerReady()
    })

    const handle = mockHandles[0]
    handle.player.paused.mockReturnValue(true)

    const playButton = screen.getByRole("button", { name: "Play" })
    await user.click(playButton)

    expect(handle.player.play).toHaveBeenCalled()
    await screen.findByRole("button", { name: "Pause" })
  })

  test("Enter key on selected slide triggers play/pause", async () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    await act(async () => {
      mockHandles[0]?.triggerReady()
    })

    const handle = mockHandles[0]
    handle.player.paused.mockReturnValue(true)

    const slide = document.querySelector("[data-index='0']")!
    fireEvent.keyDown(slide, { key: "Enter" })

    expect(handle.player.play).toHaveBeenCalled()
  })

  test("handles empty videoData gracefully", () => {
    renderWithProviders(
      <VideoShortsModal startIndex={0} videoData={[]} onClose={jest.fn()} />,
    )

    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(2)
  })

  test("renders placeholder (not video player) when streaming_url is null", () => {
    const videoData = [
      makeVideoResource({
        title: "No URL Video",
        video: {
          id: 1,
          streaming_url: null,
          duration: "PT1M",
          caption_urls: [],
          cover_image_url: null,
        },
      }),
    ]

    renderWithProviders(
      <VideoShortsModal
        startIndex={0}
        videoData={videoData}
        onClose={jest.fn()}
      />,
    )

    // No VideoJsPlayer rendered — no <video> element in the DOM
    expect(document.querySelector("video")).toBeNull()
  })

  describe("PostHog tracking", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
    })
    afterEach(() => {
      delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
    })
    test("captures VideoShortViewed for the video being left when scrolling", async () => {
      const videoData = [
        makeVideoResource({ title: "First Video" }),
        makeVideoResource({ title: "Second Video" }),
      ]

      renderWithProviders(
        <VideoShortsModal
          startIndex={0}
          videoData={videoData}
          onClose={jest.fn()}
        />,
      )

      // Simulate player ready with a valid duration for slide 0
      await act(async () => {
        mockHandles[0]?.triggerReady()
        mockHandles[0]?.player.duration.mockReturnValue(30)
      })

      act(() => {
        triggerSlidesInView([1])
      })

      const call = mockedPostHogCapture.mock.calls.find(
        ([event]) => event === "video_short_viewed",
      )
      // Event describes the video being LEFT (slide 0), not the one arrived at
      expect(call?.[1]).toMatchObject({
        videoId: videoData[0].id,
        videoTitle: "First Video",
      })
      expect(call?.[1]).toHaveProperty("timeOnVideoMs")
      expect(call?.[1].videoDurationMs).toBe(30000)
      expect(call?.[1]).not.toHaveProperty("percentageWatched")
    })

    test("captures VideoShortViewed for the current video on close", async () => {
      renderWithProviders(<VideoShortsModal {...defaultProps} />)

      await user.click(screen.getByRole("button", { name: "Close" }))

      const call = mockedPostHogCapture.mock.calls.find(
        ([event]) => event === "video_short_viewed",
      )
      expect(call?.[1]).toMatchObject({
        videoId: defaultProps.videoData[0].id,
        videoTitle: "First Video",
      })
      expect(call?.[1]).toHaveProperty("timeOnVideoMs")
    })

    test("totalVideosViewed is 1 when closing without scrolling", async () => {
      renderWithProviders(<VideoShortsModal {...defaultProps} />)

      await user.click(screen.getByRole("button", { name: "Close" }))

      const call = mockedPostHogCapture.mock.calls.find(
        ([event]) => event === "video_shorts_closed",
      )
      expect(call?.[1].totalVideosViewed).toBe(1)
    })

    test("totalVideosViewed increments as user scrolls through videos", async () => {
      renderWithProviders(<VideoShortsModal {...defaultProps} />)

      act(() => {
        triggerSlidesInView([1])
      })

      await user.click(screen.getByRole("button", { name: "Close" }))

      const call = mockedPostHogCapture.mock.calls.find(
        ([event]) => event === "video_shorts_closed",
      )
      expect(call?.[1].totalVideosViewed).toBe(2)
    })

    test("totalVideosViewed does not double-count when scrolling back to a previous video", async () => {
      renderWithProviders(<VideoShortsModal {...defaultProps} />)

      // Scroll away then back — neither should double-count
      act(() => {
        triggerSlidesInView([1])
      })
      act(() => {
        triggerSlidesInView([0]) // scroll back to initial video
      })

      await user.click(screen.getByRole("button", { name: "Close" }))

      const call = mockedPostHogCapture.mock.calls.find(
        ([event]) => event === "video_shorts_closed",
      )
      expect(call?.[1].totalVideosViewed).toBe(2) // 2 unique videos, no double-count
    })

    test("captures VideoShortsClosed with sessionDurationMs when close button is clicked", async () => {
      renderWithProviders(<VideoShortsModal {...defaultProps} />)

      await user.click(screen.getByRole("button", { name: "Close" }))

      expect(mockedPostHogCapture).toHaveBeenCalledWith(
        "video_shorts_closed",
        expect.objectContaining({
          sessionDurationMs: expect.any(Number),
        }),
      )
    })

    test("captures VideoShortsClosed with sessionDurationMs when Escape key is pressed", () => {
      renderWithProviders(<VideoShortsModal {...defaultProps} />)

      fireEvent.keyDown(document, { key: "Escape" })

      expect(mockedPostHogCapture).toHaveBeenCalledWith(
        "video_shorts_closed",
        expect.objectContaining({
          sessionDurationMs: expect.any(Number),
        }),
      )
    })

    test("sessionDurationMs is non-negative", async () => {
      renderWithProviders(<VideoShortsModal {...defaultProps} />)

      await user.click(screen.getByRole("button", { name: "Close" }))

      const call = mockedPostHogCapture.mock.calls.find(
        ([event]) => event === "video_shorts_closed",
      )
      expect(call?.[1].sessionDurationMs).toBeGreaterThanOrEqual(0)
    })

    test("flushes session analytics on pagehide", () => {
      renderWithProviders(<VideoShortsModal {...defaultProps} />)

      act(() => {
        window.dispatchEvent(new Event("pagehide"))
      })

      expect(mockedPostHogCapture).toHaveBeenCalledWith(
        "video_shorts_closed",
        expect.objectContaining({
          sessionDurationMs: expect.any(Number),
          totalVideosViewed: 1,
        }),
      )
    })

    test("flushes session analytics when the page is hidden", () => {
      renderWithProviders(<VideoShortsModal {...defaultProps} />)

      act(() => {
        Object.defineProperty(document, "visibilityState", {
          value: "hidden",
          configurable: true,
        })
        document.dispatchEvent(new Event("visibilitychange"))
      })

      expect(mockedPostHogCapture).toHaveBeenCalledWith(
        "video_shorts_closed",
        expect.objectContaining({ sessionDurationMs: expect.any(Number) }),
      )

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      })
    })

    test("does not emit duplicate close events when pagehide follows an explicit close", async () => {
      renderWithProviders(<VideoShortsModal {...defaultProps} />)

      await user.click(screen.getByRole("button", { name: "Close" }))
      act(() => {
        window.dispatchEvent(new Event("pagehide"))
      })

      const closeCalls = mockedPostHogCapture.mock.calls.filter(
        ([event]) => event === "video_shorts_closed",
      )
      expect(closeCalls).toHaveLength(1)
    })
  })

  describe("playback", () => {
    test("autoplays the selected video after Embla settles when startIndex > 0", async () => {
      const videoData = [
        makeVideoResource({ title: "First" }),
        makeVideoResource({ title: "Second" }),
        makeVideoResource({ title: "Third" }),
      ]
      renderWithProviders(
        <VideoShortsModal
          startIndex={2}
          videoData={videoData}
          onClose={jest.fn()}
        />,
      )

      await act(async () => {
        mockHandles.forEach((handle) => {
          handle.triggerReady()
          handle.player.paused.mockReturnValue(true)
        })
      })

      // Embla animates from slide 0 to startIndex, firing intermediate events.
      act(() => triggerSlidesInView([0]))
      act(() => triggerSlidesInView([1]))
      act(() => triggerSlidesInView([2]))

      // The selected video should be playing (button reflects "Pause").
      expect(
        await screen.findByRole("button", { name: "Pause" }),
      ).toBeInTheDocument()
    })

    test("keeps the playing state on same-slide re-emit", async () => {
      const videoData = [makeVideoResource({ title: "Only" })]
      renderWithProviders(
        <VideoShortsModal
          startIndex={0}
          videoData={videoData}
          onClose={jest.fn()}
        />,
      )

      await act(async () => {
        mockHandles[0]?.triggerReady()
        mockHandles[0]?.player.paused.mockReturnValue(true)
      })

      act(() => triggerSlidesInView([0]))
      act(() => triggerSlidesInView([0]))

      expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    })
  })
})
