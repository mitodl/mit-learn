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

test("bare episode URL redirects to the slugged canonical with corrected parent", async () => {
  const id = 555
  const episode = factories.learningResources.podcastEpisode({
    id,
    title: "Episode One",
    podcast_episode: { podcasts: [10] },
    // The backend names the slug; the factory default is a drawer URL.
    learn_url: `http://test.learn.odl.local:8062/podcast/10/podcast_episode/${id}/episode-one`,
  })
  setMockResponse.get(
    urls.learningResources.details({ id: episode.id }),
    episode,
  )
  await expect(
    // podcast 999 is not a member → corrected to 10
    Page({
      params: Promise.resolve({
        podcastId: "999",
        episodeId: String(episode.id),
      }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/podcast/10/podcast_episode/${episode.id}/episode-one`,
  )
})
