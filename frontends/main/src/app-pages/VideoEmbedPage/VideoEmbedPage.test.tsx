import React from "react"
import { setMockResponse, urls, factories } from "api/test-utils"
import { renderWithProviders, screen, waitFor } from "@/test-utils"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import VideoEmbedPage from "./VideoEmbedPage"
import type { VideoResource } from "api/v1"
import { ResourceTypeEnum } from "api/v1"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({}),
}))

jest.mock("next/navigation", () => ({
  ...jest.requireActual("next/navigation"),
  notFound: jest.fn(),
}))

jest.mock("@/app-pages/VideoPlaylistCollectionPage/VideoJsPlayer", () => ({
  __esModule: true,
  default: (props: { sources?: { src: string; type: string }[] }) => (
    <div
      data-testid="video-js-player"
      data-sources={JSON.stringify(props.sources ?? [])}
    />
  ),
}))

const makeVideo = (overrides: Partial<VideoResource> = {}): VideoResource =>
  factories.learningResources.video({
    resource_type: ResourceTypeEnum.Video,
    video: {
      id: 1,
      streaming_url: "https://example.com/video.m3u8",
      duration: "PT10M",
      caption_urls: [],
      cover_image_url: null,
    },
    ...overrides,
  }) as VideoResource

const setupVideoApi = (video: VideoResource) => {
  setMockResponse.get(urls.learningResources.details({ id: video.id }), video)
}

describe("VideoEmbedPage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
  })

  test("renders VideoJsPlayer for a video with a streaming URL", async () => {
    const video = makeVideo()
    setupVideoApi(video)

    renderWithProviders(<VideoEmbedPage videoId={video.id} />)

    const player = await screen.findByTestId("video-js-player")
    expect(player).toBeInTheDocument()

    const sources = JSON.parse(player.getAttribute("data-sources") ?? "[]")
    expect(sources[0].type).toBe("application/x-mpegURL")
  })

  test("renders VideoJsPlayer with mp4 source type", async () => {
    const video = makeVideo({
      video: {
        id: 2,
        streaming_url: "https://example.com/video.mp4",
        duration: "PT5M",
        caption_urls: [],
        cover_image_url: null,
      },
    })
    setupVideoApi(video)

    renderWithProviders(<VideoEmbedPage videoId={video.id} />)

    const player = await screen.findByTestId("video-js-player")
    const sources = JSON.parse(player.getAttribute("data-sources") ?? "[]")
    expect(sources[0].type).toBe("video/mp4")
  })

  test("calls notFound when feature flag is off and flags are loaded", async () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)

    const video = makeVideo()
    setupVideoApi(video)

    renderWithProviders(<VideoEmbedPage videoId={video.id} />)

    await waitFor(() => expect(notFound).toHaveBeenCalled())
  })

  test("does not call notFound while feature flags are still loading", () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
    mockedUseFeatureFlagsLoaded.mockReturnValue(false)

    const video = makeVideo()
    setupVideoApi(video)

    renderWithProviders(<VideoEmbedPage videoId={video.id} />)

    expect(notFound).not.toHaveBeenCalled()
  })
})
