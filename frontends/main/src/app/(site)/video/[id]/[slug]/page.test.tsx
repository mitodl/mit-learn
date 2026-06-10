import { notFound, redirect } from "next/navigation"
import { factories, setMockResponse, urls } from "api/test-utils"
import type { VideoResource } from "api/v1"
import Page, { generateMetadata } from "./page"

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

test("redirects to the first playlist when ?playlist isn't canonical, carrying other params", async () => {
  const video = mockVideo(["55", "66"])
  await expect(
    Page({
      params: Promise.resolve({ id: String(video.id), slug: "beyond-biology" }),
      // playlist 999 is not a member; utm should survive the redirect
      searchParams: Promise.resolve({ playlist: "999", utm_source: "x" }),
    }),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/video/${video.id}/beyond-biology?utm_source=x&playlist=55`,
  )
})

test("generateMetadata canonical includes the playlist (criterion 5's SEO half)", async () => {
  const video = mockVideo(["55", "66"])
  const meta = await generateMetadata({
    params: Promise.resolve({ id: String(video.id), slug: "beyond-biology" }),
    searchParams: Promise.resolve({ playlist: "66" }),
  })
  expect(meta.alternates?.canonical).toMatch(
    new RegExp(`/video/${video.id}/beyond-biology\\?playlist=66$`),
  )
})

test("notFound for a resource that is not a video", async () => {
  const course = factories.learningResources.course()
  setMockResponse.get(urls.learningResources.details({ id: course.id }), course)
  await expect(
    Page({
      params: Promise.resolve({ id: String(course.id), slug: "x" }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NEXT_NOT_FOUND")
})

test("a no-playlist video's canonical has no ?playlist param", async () => {
  const video = mockVideo([])
  await expect(
    Page({
      params: Promise.resolve({ id: String(video.id), slug: "stale" }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(`/video/${video.id}/beyond-biology`)
})
