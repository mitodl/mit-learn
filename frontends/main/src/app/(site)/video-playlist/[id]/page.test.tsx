import { redirect } from "next/navigation"
import { factories, setMockResponse, urls } from "api/test-utils"
import Page from "./page"

jest.mock("@/app/getQueryClient", () => {
  const { makeBrowserQueryClient } = jest.requireActual("@/app/getQueryClient")
  return { getQueryClient: () => makeBrowserQueryClient({ maxRetries: 0 }) }
})

const mockRedirect = jest.mocked(redirect)
beforeEach(() => {
  mockRedirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT")
  })
})

test("bare /video-playlist/{id} redirects to the slugged canonical", async () => {
  const playlist = factories.learningResources.videoPlaylist({
    title: "Great Talks",
  })
  setMockResponse.get(
    urls.videoPlaylists.details({ id: playlist.id }),
    playlist,
  )
  await expect(
    Page({ params: Promise.resolve({ id: String(playlist.id) }) }),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/video-playlist/${playlist.id}/great-talks`,
  )
})
