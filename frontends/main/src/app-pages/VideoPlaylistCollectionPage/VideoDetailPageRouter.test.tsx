import React from "react"
import { setMockResponse, factories } from "api/test-utils"
import { renderWithProviders, screen } from "@/test-utils"
import VideoDetailPageRouter from "./VideoDetailPageRouter"

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({}),
}))

// Stub out the two leaf pages so we can assert which one is rendered
// without needing to satisfy all their own data dependencies.
jest.mock("./VideoSeriesDetailPage", () => ({
  __esModule: true,
  default: () => <div data-testid="video-series-detail-page" />,
}))

jest.mock("./VideoDetailPage", () => ({
  __esModule: true,
  default: () => <div data-testid="video-detail-page" />,
}))

const makeOcwPlaylist = () =>
  factories.learningResources.videoPlaylist({
    offered_by: { code: "ocw", name: "OCW", channel_url: null },
  })

const makeNonOcwPlaylist = () =>
  factories.learningResources.videoPlaylist({
    offered_by: { code: "xpro", name: "xPRO", channel_url: null },
  })

const setupPlaylistApi = (
  playlist: ReturnType<typeof factories.learningResources.videoPlaylist>,
) => {
  setMockResponse.get(
    expect.stringContaining(`/api/v1/video_playlists/${playlist.id}/`),
    playlist,
  )
}

describe("VideoDetailPageRouter", () => {
  describe("routing by offered_by.code", () => {
    test("renders VideoSeriesDetailPage for an OCW playlist", async () => {
      const playlist = makeOcwPlaylist()
      setupPlaylistApi(playlist)

      renderWithProviders(
        <VideoDetailPageRouter videoId={1} playlistId={playlist.id} />,
      )

      await screen.findByTestId("video-series-detail-page")
      expect(screen.queryByTestId("video-detail-page")).not.toBeInTheDocument()
    })

    test("renders VideoDetailPage for a non-OCW playlist", async () => {
      const playlist = makeNonOcwPlaylist()
      setupPlaylistApi(playlist)

      renderWithProviders(
        <VideoDetailPageRouter videoId={1} playlistId={playlist.id} />,
      )

      await screen.findByTestId("video-detail-page")
      expect(
        screen.queryByTestId("video-series-detail-page"),
      ).not.toBeInTheDocument()
    })

    test("renders VideoDetailPage when no playlistId is provided", async () => {
      renderWithProviders(
        <VideoDetailPageRouter videoId={1} playlistId={null} />,
      )

      await screen.findByTestId("video-detail-page")
      expect(
        screen.queryByTestId("video-series-detail-page"),
      ).not.toBeInTheDocument()
    })
  })
})
