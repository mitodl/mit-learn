import { notFound, redirect } from "next/navigation"
import { factories, setMockResponse, urls } from "api/test-utils"
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
  "@/app-pages/VideoPlaylistCollectionPage/VideoPlaylistCollectionPage",
  () => ({ __esModule: true, default: () => null }),
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

const mockPlaylist = () => {
  const playlist = factories.learningResources.videoPlaylist({
    title: "Great Talks",
  })
  // Playlist detail is a different endpoint from learningResources.details.
  setMockResponse.get(
    urls.videoPlaylists.details({ id: playlist.id }),
    playlist,
  )
  setMockResponse.get(
    urls.learningResources.items({ id: playlist.id }),
    factories.learningResources.resources({ count: 0 }),
  )
  return playlist
}

const pageProps = (id: string, slug: string) => ({
  params: Promise.resolve({ id, slug }),
  searchParams: Promise.resolve({}),
})

test("renders when the slug is already canonical", async () => {
  const playlist = mockPlaylist()
  await Page(pageProps(String(playlist.id), "great-talks"))
  expect(mockRedirect).not.toHaveBeenCalled()
})

test("generateMetadata sets the slugged canonical tag", async () => {
  const playlist = mockPlaylist()
  // generateMetadata fetches a single item for the social image.
  setMockResponse.get(
    `${urls.learningResources.items({ id: playlist.id })}?limit=1`,
    factories.learningResources.resources({ count: 0 }),
  )
  const meta = await generateMetadata(
    pageProps(String(playlist.id), "great-talks"),
  )
  expect(meta.alternates?.canonical).toMatch(
    new RegExp(`/video-playlist/${playlist.id}/great-talks$`),
  )
})

test("redirects a stale slug to the canonical", async () => {
  const playlist = mockPlaylist()
  await expect(Page(pageProps(String(playlist.id), "stale"))).rejects.toThrow(
    "NEXT_REDIRECT",
  )
  expect(mockRedirect).toHaveBeenCalledWith(
    `/video-playlist/${playlist.id}/great-talks`,
  )
})
