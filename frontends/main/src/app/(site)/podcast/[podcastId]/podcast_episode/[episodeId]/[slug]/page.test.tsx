import { notFound, redirect } from "next/navigation"
import { factories, setMockResponse, urls } from "api/test-utils"
import type { PodcastEpisodeResource } from "api/v1"
import Page from "./page"

jest.mock("@/app/getQueryClient", () => {
  const { makeBrowserQueryClient } = jest.requireActual("@/app/getQueryClient")
  return { getQueryClient: () => makeBrowserQueryClient({ maxRetries: 0 }) }
})
jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  dehydrate: jest.fn().mockReturnValue({}),
}))
jest.mock("@/app-pages/PodcastPage/PodcastEpisodeDetailPage", () => ({
  PodcastEpisodeDetailPage: () => null,
}))

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

/** Episode belonging to `parentIds`; also stub each parent podcast detail. */
const mockEpisode = (parentIds: number[]) => {
  const episode = factories.learningResources.podcastEpisode({
    title: "Episode One",
  }) as PodcastEpisodeResource
  episode.podcast_episode = { ...episode.podcast_episode, podcasts: parentIds }
  setMockResponse.get(
    urls.learningResources.details({ id: episode.id }),
    episode,
  )
  parentIds.forEach((pid) => {
    const parent = factories.learningResources.podcast()
    parent.id = pid
    setMockResponse.get(urls.learningResources.details({ id: pid }), parent)
  })
  return episode
}

test("redirects a wrong parent podcast id to the episode's actual podcast", async () => {
  const episode = mockEpisode([10, 20])
  await expect(
    Page({
      params: Promise.resolve({
        podcastId: "999", // not a member
        episodeId: String(episode.id),
        slug: "episode-one",
      }),
    }),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/podcast/10/podcast_episode/${episode.id}/episode-one`,
  )
})

test("keeps a valid member parent id, redirects only the stale slug", async () => {
  const episode = mockEpisode([10, 20])
  await expect(
    Page({
      params: Promise.resolve({
        podcastId: "20",
        episodeId: String(episode.id),
        slug: "stale",
      }),
    }),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/podcast/20/podcast_episode/${episode.id}/episode-one`,
  )
})

test("renders when parent id and slug are already canonical", async () => {
  const episode = mockEpisode([10, 20])
  await Page({
    params: Promise.resolve({
      podcastId: "10",
      episodeId: String(episode.id),
      slug: "episode-one",
    }),
  })
  expect(mockRedirect).not.toHaveBeenCalled()
})

test("notFound when the episode has no parent podcasts", async () => {
  const episode = mockEpisode([])
  await expect(
    Page({
      params: Promise.resolve({
        podcastId: "10",
        episodeId: String(episode.id),
        slug: "episode-one",
      }),
    }),
  ).rejects.toThrow("NEXT_NOT_FOUND")
})
