import React from "react"
import { setMockResponse, urls, factories } from "api/test-utils"
import { renderWithProviders, screen, user } from "@/test-utils"
import { usePostHog } from "posthog-js/react"
import type { PostHog } from "posthog-js"
import VideoShortsSection from "./VideoShortsSection"

jest.mock("posthog-js/react")
const mockedPostHogCapture = jest.fn()
jest.mocked(usePostHog).mockReturnValue({
  capture: mockedPostHogCapture,
} as unknown as PostHog)

// Stub VideoShortsModal to avoid rendering the full player stack
jest.mock("./VideoShortsModal", () => ({
  __esModule: true,
  default: () => <div data-testid="video-shorts-modal" />,
}))

// CarouselV2 uses scroll APIs unavailable in JSDOM; render children directly
jest.mock("ol-components/CarouselV2", () => ({
  CarouselV2: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

const setupApis = () => {
  const videos = [
    factories.learningResources.video({ title: "First Short" }),
    factories.learningResources.video({ title: "Second Short" }),
  ]

  setMockResponse.get(expect.stringContaining(urls.search.resources()), {
    count: videos.length,
    next: null,
    previous: null,
    results: videos,
  })

  return { videos }
}

describe("VideoShortsSection", () => {
  beforeEach(() => {
    mockedPostHogCapture.mockClear()
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
  })
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
  })

  test("captures VideoShortsOpened with videoId, videoTitle, and position when a thumbnail is clicked", async () => {
    const { videos } = setupApis()

    renderWithProviders(<VideoShortsSection />)

    const button = await screen.findByRole("button", {
      name: `Play ${videos[0].title}`,
    })
    await user.click(button)

    expect(mockedPostHogCapture).toHaveBeenCalledWith(
      "video_shorts_opened",
      expect.objectContaining({
        videoId: videos[0].id,
        videoTitle: videos[0].title,
        position: 0,
      }),
    )
  })

  test("captures VideoShortsOpened with correct position for non-first thumbnail", async () => {
    const { videos } = setupApis()

    renderWithProviders(<VideoShortsSection />)

    const button = await screen.findByRole("button", {
      name: `Play ${videos[1].title}`,
    })
    await user.click(button)

    expect(mockedPostHogCapture).toHaveBeenCalledWith(
      "video_shorts_opened",
      expect.objectContaining({
        videoId: videos[1].id,
        videoTitle: videos[1].title,
        position: 1,
      }),
    )
  })
})
