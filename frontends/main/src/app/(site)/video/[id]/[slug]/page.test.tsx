import { notFound, redirect } from "next/navigation"
import { factories, setMockResponse, urls } from "api/test-utils"
import type { VideoResource } from "api/v1"
import Page from "./page"

jest.mock("@/app/getQueryClient", () => {
  const { makeBrowserQueryClient } = jest.requireActual("@/app/getQueryClient")
  return { getQueryClient: () => makeBrowserQueryClient({ maxRetries: 0 }) }
})
jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  dehydrate: jest.fn().mockReturnValue({}),
}))
jest.mock(
  "@/app-pages/VideoPlaylistCollectionPage/VideoDetailPageRouter",
  () => ({
    __esModule: true,
    default: () => null,
  }),
)

const mockRedirect = jest.mocked(redirect)
const mockNotFound = jest.mocked(notFound)
beforeEach(() => {
  mockRedirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT")
  })
  mockNotFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND")
  })
})

const mockVideo = (playlists: string[]) => {
  const video = factories.learningResources.video({
    title: "Beyond Biology",
  }) as VideoResource
  video.playlists = playlists
  setMockResponse.get(urls.learningResources.details({ id: video.id }), video)
  playlists.forEach((pid) => {
    const pl = factories.learningResources.videoPlaylist()
    pl.id = Number(pid)
    // Playlist detail is a different endpoint from learningResources.details.
    setMockResponse.get(urls.videoPlaylists.details({ id: Number(pid) }), pl)
    setMockResponse.get(
      urls.learningResources.items({ id: Number(pid) }),
      factories.learningResources.resources({ count: 0 }),
    )
  })
  return video
}

test("honors a member ?playlist and renders when canonical", async () => {
  const video = mockVideo(["55", "66"])
  await Page({
    params: Promise.resolve({ id: String(video.id), slug: "beyond-biology" }),
    searchParams: Promise.resolve({ playlist: "66" }),
  })
  expect(mockRedirect).not.toHaveBeenCalled()
})

test("redirects to the first playlist when ?playlist isn't canonical", async () => {
  const video = mockVideo(["55", "66"])
  await expect(
    Page({
      params: Promise.resolve({ id: String(video.id), slug: "beyond-biology" }),
      searchParams: Promise.resolve({ playlist: "999" }), // not a member
    }),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/video/${video.id}/beyond-biology?playlist=55`,
  )
})

test("renders a video with no playlists (canonical slug, no param)", async () => {
  const video = mockVideo([])
  await Page({
    params: Promise.resolve({ id: String(video.id), slug: "beyond-biology" }),
    searchParams: Promise.resolve({}),
  })
  expect(mockRedirect).not.toHaveBeenCalled()
})
