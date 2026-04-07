import React from "react"
import { setMockResponse, urls, factories } from "api/test-utils"
import { renderWithProviders, screen, user } from "@/test-utils"
import { notFound } from "next/navigation"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import VideoPage from "./VideoPage"
import { ResourceTypeEnum } from "api/v1"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

const mockPush = jest.fn<void, [string]>()
jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

const makePlaylist = () =>
  factories.learningResources.videoPlaylist({
    title: "MIT Faculty Interviews",
    description: "Conversations with faculty on the future of technology.",
  })

const makeVideo = (overrides = {}) =>
  factories.learningResources.resource({
    resource_type: ResourceTypeEnum.Video,
    ...overrides,
  })

const setupApis = ({
  playlistId,
  videos,
  playlist = makePlaylist(),
  similarCollections = [],
}: {
  playlistId: number
  videos: ReturnType<typeof makeVideo>[]
  playlist?: ReturnType<typeof makePlaylist>
  similarCollections?: ReturnType<typeof makePlaylist>[]
}) => {
  // Playlist detail endpoint: /api/v1/video_playlists/{id}/
  setMockResponse.get(
    expect.stringContaining(`/api/v1/video_playlists/${playlistId}/`),
    playlist,
  )

  // Items endpoint: /api/v1/learning_resources/{id}/items/
  const itemRelationships = videos.map((resource, i) => ({
    id: i + 1,
    child: resource.id,
    parent: playlistId,
    position: i + 1,
    resource,
  }))
  setMockResponse.get(urls.learningResources.items({ id: playlistId }), {
    count: videos.length,
    next: null,
    previous: null,
    results: itemRelationships,
  })

  setMockResponse.get(
    urls.learningResources.vectorSimilar({ id: playlistId }),
    {
      count: similarCollections.length,
      next: null,
      previous: null,
      results: similarCollections,
    },
  )
}

describe("VideoPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
  })

  describe("feature-flag gating", () => {
    test("calls notFound when the VideoPlaylistPage flag is disabled and flags are loaded", () => {
      mockedUseFeatureFlagEnabled.mockReturnValue(false)
      mockedUseFeatureFlagsLoaded.mockReturnValue(true)
      const playlist = makePlaylist()
      setupApis({ playlistId: playlist.id, videos: [], playlist })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      expect(notFound).toHaveBeenCalled()
    })

    test("does not call notFound when the flag is enabled", () => {
      mockedUseFeatureFlagEnabled.mockReturnValue(true)
      const playlist = makePlaylist()
      setupApis({ playlistId: playlist.id, videos: [], playlist })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      expect(notFound).not.toHaveBeenCalled()
    })

    test("does not call notFound when the flag is undefined and flags are not yet loaded", () => {
      // posthog returns undefined before flags are evaluated
      mockedUseFeatureFlagEnabled.mockReturnValue(undefined)
      mockedUseFeatureFlagsLoaded.mockReturnValue(false)
      const playlist = makePlaylist()
      setupApis({ playlistId: playlist.id, videos: [], playlist })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      expect(notFound).not.toHaveBeenCalled()
    })
  })

  describe("playlist header", () => {
    test("renders the playlist title once data is loaded", async () => {
      const playlist = makePlaylist()
      setupApis({ playlistId: playlist.id, videos: [], playlist })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      await screen.findByRole("heading", { name: playlist.title })
    })

    test("renders the playlist description once data is loaded", async () => {
      const playlist = makePlaylist()
      setupApis({ playlistId: playlist.id, videos: [], playlist })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      await screen.findByText(playlist.description!)
    })
  })

  describe("featured video", () => {
    test("renders the first video as the featured video after loading", async () => {
      const playlist = makePlaylist()
      const featured = makeVideo({ title: "Featured Interview Title" })
      setupApis({ playlistId: playlist.id, videos: [featured], playlist })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      await screen.findAllByText(featured.title)
    })

    test("does not render featured video section when there are no videos", async () => {
      const playlist = makePlaylist()
      setupApis({ playlistId: playlist.id, videos: [], playlist })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      await screen.findByRole("heading", { name: playlist.title })
      // With no videos the featured video grid should be absent
      expect(screen.queryByRole("img")).not.toBeInTheDocument()
    })
  })

  describe("collection videos", () => {
    test("renders collection videos (all except first) after loading", async () => {
      const playlist = makePlaylist()
      const [first, second, third] = [
        makeVideo({ title: "Video One" }),
        makeVideo({ title: "Video Two" }),
        makeVideo({ title: "Video Three" }),
      ]
      setupApis({
        playlistId: playlist.id,
        videos: [first, second, third],
        playlist,
      })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      await screen.findByText(second.title)
      await screen.findByText(third.title)
    })

    test("collection contains all videos except the featured one", async () => {
      const playlist = makePlaylist()
      const [featured, collection1, collection2] = [
        makeVideo({ title: "Featured Video" }),
        makeVideo({ title: "Collection Video A" }),
        makeVideo({ title: "Collection Video B" }),
      ]
      setupApis({
        playlistId: playlist.id,
        videos: [featured, collection1, collection2],
        playlist,
      })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      // Wait for data to load
      await screen.findByText(collection1.title)

      // Collection should contain Collection Video A and B, but featured
      // appears only in the featured section (desktop-title + mobile-title spans), not in the collection list
      const allFeatured = screen.getAllByText(featured.title)
      expect(allFeatured).toHaveLength(2)
    })
  })

  describe("other collections", () => {
    test("renders other collections from similar resources", async () => {
      const playlist = makePlaylist()
      const similarCollections = [
        factories.learningResources.videoPlaylist({
          title: "MIT Research Highlights",
          resource_category: "Collection",
          video_playlist: {
            video_count: 22,
            channel: {
              channel_id: "101",
              title: "MIT Open Learning",
            },
          },
          duration: "PT8H24M",
        }),
      ]

      setupApis({
        playlistId: playlist.id,
        videos: [makeVideo({ title: "Featured Video" })],
        playlist,
        similarCollections,
      })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      await screen.findByText("Other Collections")
      await screen.findByText("MIT Research Highlights")
      await screen.findByText("22 videos · 8h 24m")
    })
  })

  describe("video navigation", () => {
    test("navigates to the detail page when a collection video is clicked", async () => {
      const playlist = makePlaylist()
      const [featured, collection] = [
        makeVideo({ title: "Featured Video" }),
        makeVideo({ title: "Collection Video" }),
      ]
      setupApis({
        playlistId: playlist.id,
        videos: [featured, collection],
        playlist,
      })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      await user.click(await screen.findByText(collection.title))

      expect(mockPush).toHaveBeenCalledWith(
        `/playlist/detail/${collection.id}?playlist=${playlist.id}`,
      )
    })

    test("navigates to the detail page when the featured video is clicked", async () => {
      const playlist = makePlaylist()
      const featured = makeVideo({ title: "Quantum Computing and the Future" })
      setupApis({
        playlistId: playlist.id,
        videos: [featured],
        playlist,
      })

      renderWithProviders(<VideoPage playlistId={playlist.id} />)

      await user.click(await screen.findByText(featured.title))

      expect(mockPush).toHaveBeenCalledWith(
        `/playlist/detail/${featured.id}?playlist=${playlist.id}`,
      )
    })
  })
})
