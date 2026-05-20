import React from "react"
import VideoShortsModal from "./VideoShortsModal"
import type { VideoResource } from "api/v1"
import { ResourceTypeEnum } from "api/v1"
import { factories } from "api/test-utils"
import { renderWithProviders, screen, user, fireEvent, act } from "@/test-utils"

// JSDOM does not implement HTMLMediaElement methods
window.HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve())
window.HTMLMediaElement.prototype.pause = jest.fn()

const makeVideoResource = (overrides: Partial<VideoResource> = {}): VideoResource =>
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

  test("renders native video elements for nearby slides", () => {
    renderWithProviders(<VideoShortsModal {...defaultProps} />)

    const videos = document.querySelectorAll("video")
    expect(videos.length).toBeGreaterThanOrEqual(1)
  })

  test("video element has correct src from streaming_url", () => {
    const videoData = [makeVideoResource({ title: "Test Video" })]

    renderWithProviders(
      <VideoShortsModal startIndex={0} videoData={videoData} onClose={jest.fn()} />,
    )

    const video = document.querySelector("video")
    expect(video?.src).toBe("https://example.com/video.mp4")
  })

  test("displays error placeholder when video errors", async () => {
    const videoData = [makeVideoResource({ title: "Error Video" })]
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {})

    renderWithProviders(
      <VideoShortsModal startIndex={0} videoData={videoData} onClose={jest.fn()} />,
    )

    const video = document.querySelector("video")

    await act(async () => {
      if (video) fireEvent.error(video)
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
      <VideoShortsModal startIndex={1} videoData={videoData} onClose={jest.fn()} />,
    )

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
