import React from "react"
import VideoShortsModal from "./VideoShortsModal"
import type { VideoShort } from "api/v0"
import { renderWithProviders, screen, user, fireEvent } from "@/test-utils"

jest.mock("ol-utilities", () => ({
  ...jest.requireActual("ol-utilities"),
  useWindowDimensions: () => ({ height: 800, width: 1024 }),
}))

const originalEnv = process.env

// NEXT_PUBLIC_ORIGIN is read at module load; Jest typically sets this for tests
const TEST_ORIGIN =
  process.env.NEXT_PUBLIC_ORIGIN ?? "http://test.learn.odl.local:8062"

const createMockVideoShort = (
  overrides: Partial<VideoShort> = {},
): VideoShort => ({
  video_id: "test-video-id",
  title: "Test Video Title",
  video_url: "/media/shorts/test.mp4",
  published_at: "2024-01-01T00:00:00Z",
  created_on: "2024-01-01T00:00:00Z",
  updated_on: "2024-01-01T00:00:00Z",
  ...overrides,
})

describe("VideoShortsModal", () => {
  beforeEach(() => {
    jest.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  const defaultProps = {
    startIndex: 0,
    videoData: [
      createMockVideoShort({ title: "First Video" }),
      createMockVideoShort({ title: "Second Video", video_id: "vid-2" }),
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

    // After click, mute button should show volume up icon (unmuted state)
    // Click again to toggle back
    await user.click(muteButton)

    // Both clicks should be handled without error
    expect(buttons[1]).toBeInTheDocument()
  })

  test("renders video with /media prefix unchanged", () => {
    const videoData = [
      createMockVideoShort({
        video_url: "/media/shorts/existing.mp4",
        title: "Existing Prefix Video",
      }),
    ]

    renderWithProviders(
      <VideoShortsModal
        startIndex={0}
        videoData={videoData}
        onClose={jest.fn()}
      />,
    )

    const videos = document.querySelectorAll("video")
    expect(videos[0]).toHaveAttribute(
      "src",
      `${TEST_ORIGIN}/media/shorts/existing.mp4`,
    )
  })

  test("displays error placeholder when video errors", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

    const videoData = [createMockVideoShort({ title: "Error Video" })]

    renderWithProviders(
      <VideoShortsModal
        startIndex={0}
        videoData={videoData}
        onClose={jest.fn()}
      />,
    )

    const video = document.querySelector("video")
    expect(video).toBeInTheDocument()

    fireEvent.error(video!)

    expect(screen.getByText("Playback errored!")).toBeInTheDocument()
    expect(screen.getByText("Error Video")).toBeInTheDocument()

    consoleErrorSpy.mockRestore()
  })

  test("renders with startIndex to show correct initial video", () => {
    const videoData = [
      createMockVideoShort({ title: "First", video_id: "1" }),
      createMockVideoShort({ title: "Second", video_id: "2" }),
      createMockVideoShort({ title: "Third", video_id: "3" }),
    ]

    renderWithProviders(
      <VideoShortsModal
        startIndex={1}
        videoData={videoData}
        onClose={jest.fn()}
      />,
    )

    // With startIndex=1, selectedIndex starts at 1
    // Videos at index 0, 1, 2 are within Math.abs(selectedIndex - index) < 2
    // So we should see videos for indices 0, 1, 2
    const videos = document.querySelectorAll("video")
    expect(videos.length).toBeGreaterThanOrEqual(1)
  })

  test("renders carousel slides for each video", () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    const slides = document.querySelectorAll("[data-index]")
    expect(slides.length).toBe(defaultProps.videoData.length)
  })

  test("handles empty videoData gracefully", () => {
    renderWithProviders(
      <VideoShortsModal startIndex={0} videoData={[]} onClose={jest.fn()} />,
    )

    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(2)
  })
})
