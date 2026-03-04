import React from "react"
import { render, screen } from "@testing-library/react"

// Mock video.js with all functionality inline
jest.mock("video.js", () => {
  const mockPlayer = {
    dispose: jest.fn(),
    on: jest.fn(),
    isDisposed: jest.fn(() => false),
    error: jest.fn(),
    ready: jest.fn((callback) => {
      // Call the callback immediately in tests
      callback()
    }),
    addRemoteTextTrack: jest.fn(),
    textTracks: jest.fn(() => ({
      length: 0,
      tracks_: [],
    })),
  }

  const mockFn = jest.fn(() => mockPlayer)

  return Object.assign(mockFn, {
    browser: {
      IS_SAFARI: false,
    },
  })
})

jest.mock("video.js/dist/video-js.css", () => ({}))

// Import component and videojs
import { VideoJsPlayer } from "./VideoJsPlayer"
import videojs from "video.js"

// Type the mocked videojs
const mockedVideojs = videojs as jest.MockedFunction<typeof videojs>

describe("VideoJsPlayer", () => {
  const defaultProps = {
    src: "https://example.cloudfront.net/video.m3u8",
    caption: "Test Video",
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders a video player container", () => {
    render(<VideoJsPlayer {...defaultProps} />)
    const container = screen.getByTitle(defaultProps.caption)
    expect(container).toBeInTheDocument()
  })

  it("initializes video.js player with correct options", () => {
    render(<VideoJsPlayer {...defaultProps} />)

    expect(mockedVideojs).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        controls: true,
        responsive: true,
        fluid: true,
        preload: "auto",
      }),
    )
  })

  it("sets HLS source correctly", () => {
    render(<VideoJsPlayer {...defaultProps} />)

    const [[, options]] = mockedVideojs.mock.calls
    expect(options.sources).toEqual([
      {
        src: defaultProps.src,
        type: "application/x-mpegURL",
      },
    ])
  })

  it("registers error handler", () => {
    render(<VideoJsPlayer {...defaultProps} />)

    const mockPlayer = mockedVideojs.mock.results[0].value
    expect(mockPlayer.on).toHaveBeenCalledWith("error", expect.any(Function))
  })

  it("handles player errors by logging", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation()
    const error = { code: 4, message: "Network error" }

    render(<VideoJsPlayer {...defaultProps} />)

    const mockPlayer = mockedVideojs.mock.results[0].value
    mockPlayer.error.mockReturnValue(error)

    // Trigger the error handler
    const errorHandler = mockPlayer.on.mock.calls.find(
      ([event]: [string]) => event === "error",
    )?.[1]
    errorHandler?.()

    expect(consoleSpy).toHaveBeenCalledWith("Video.js error:", error)
    consoleSpy.mockRestore()
  })

  it("disposes player on unmount", () => {
    const { unmount } = render(<VideoJsPlayer {...defaultProps} />)

    const mockPlayer = mockedVideojs.mock.results[0].value

    unmount()

    expect(mockPlayer.isDisposed).toHaveBeenCalled()
    expect(mockPlayer.dispose).toHaveBeenCalled()
  })

  it("does not dispose if already disposed", () => {
    const { unmount } = render(<VideoJsPlayer {...defaultProps} />)

    const mockPlayer = mockedVideojs.mock.results[0].value
    mockPlayer.isDisposed.mockReturnValue(true)

    unmount()

    expect(mockPlayer.isDisposed).toHaveBeenCalled()
    expect(mockPlayer.dispose).not.toHaveBeenCalled()
  })

  it("initializes player only once", () => {
    const { rerender } = render(<VideoJsPlayer {...defaultProps} />)

    expect(mockedVideojs).toHaveBeenCalledTimes(1)

    rerender(<VideoJsPlayer {...defaultProps} />)

    expect(mockedVideojs).toHaveBeenCalledTimes(1)
  })

  it("does not reinitialize when src changes", () => {
    const { rerender } = render(<VideoJsPlayer {...defaultProps} />)

    expect(mockedVideojs).toHaveBeenCalledTimes(1)

    const newSrc = "https://example.cloudfront.net/new-video.m3u8"
    rerender(<VideoJsPlayer src={newSrc} caption={defaultProps.caption} />)

    // Player is not reinitialized when src changes because playerRef.current exists
    // To change video source, the player would need to be updated via player.src()
    expect(mockedVideojs).toHaveBeenCalledTimes(1)
  })

  it("applies correct CSS classes to video element", () => {
    render(<VideoJsPlayer {...defaultProps} />)

    const videoElement = mockedVideojs.mock.calls[0][0] as HTMLElement
    expect(videoElement.classList.contains("vjs-big-play-centered")).toBe(true)
  })

  it("sets container with data-vjs-player attribute", () => {
    render(<VideoJsPlayer {...defaultProps} />)

    const titleElement = screen.getByTitle(defaultProps.caption)
    const playerContainer = titleElement.parentElement
    expect(playerContainer).toHaveAttribute("data-vjs-player")
    expect(playerContainer).toHaveStyle({ width: "100%", height: "100%" })
  })
})
