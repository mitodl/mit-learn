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

test("bare /video/{id} redirects to the slug + first playlist", async () => {
  const video = factories.learningResources.video({
    title: "Beyond Biology",
    playlists: ["55", "66"],
  })
  setMockResponse.get(urls.learningResources.details({ id: video.id }), video)
  await expect(
    Page({
      params: Promise.resolve({ id: String(video.id) }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/video/${video.id}/beyond-biology?playlist=55`,
  )
})
