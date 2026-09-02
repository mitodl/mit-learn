import { notFound, redirect } from "next/navigation"
import { dehydrate } from "@tanstack/react-query"
import { factories, makeRequest, setMockResponse, urls } from "api/test-utils"
import { podcastEpisodeQueries } from "api/hooks/learningResources"
import Page, { generateMetadata } from "./page"

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

const mockEpisode = (
  parentIds: number[],
  { hasTranscript = false },
  slug = "episode-one",
) => {
  const id = 555
  const episode = factories.learningResources.podcastEpisode({
    id,
    title: "Episode One",
    podcast_episode: { podcasts: parentIds, has_transcript: hasTranscript },
    // The backend names the slug, always under the canonical parent; the page
    // resolves the parent segment against the request.
    learn_url: `http://test.learn.odl.local:8062/podcast/${parentIds[0]}/podcast_episode/${id}/${slug}`,
  })
  setMockResponse.get(
    urls.learningResources.details({ id: episode.id }),
    episode,
  )
  parentIds.forEach((pid) => {
    const parent = factories.learningResources.podcast({ id: pid })
    setMockResponse.get(urls.learningResources.details({ id: pid }), parent)
  })
  return episode
}

const pageProps = (podcastId: string, episodeId: string, slug: string) => ({
  params: Promise.resolve({ podcastId, episodeId, slug }),
  searchParams: Promise.resolve({}),
})

test("redirects a wrong parent podcast id to the episode's actual podcast", async () => {
  const episode = mockEpisode([10, 20], { hasTranscript: false })
  await expect(
    // podcast 999 is not a member
    Page(pageProps("999", String(episode.id), "episode-one")),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/podcast/10/podcast_episode/${episode.id}/episode-one`,
  )
})

test("keeps a valid member parent id, redirects only the stale slug", async () => {
  const episode = mockEpisode([10, 20], { hasTranscript: false })
  await expect(
    Page(pageProps("20", String(episode.id), "stale")),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/podcast/20/podcast_episode/${episode.id}/episode-one`,
  )
})

test("renders when parent id and slug are already canonical", async () => {
  const episode = mockEpisode([10, 20], { hasTranscript: false })
  await Page(pageProps("10", String(episode.id), "episode-one"))
  expect(mockRedirect).not.toHaveBeenCalled()
})

test("generateMetadata canonical corrects a non-member parent podcast id", async () => {
  const episode = mockEpisode([10, 20], { hasTranscript: false })
  const meta = await generateMetadata(
    pageProps("999", String(episode.id), "episode-one"),
  )
  expect(meta.alternates?.canonical).toMatch(
    new RegExp(`/podcast/10/podcast_episode/${episode.id}/episode-one$`),
  )
})

test("generateMetadata 404s for a resource that is not a podcast episode", async () => {
  const course = factories.learningResources.course()
  setMockResponse.get(urls.learningResources.details({ id: course.id }), course)
  await expect(
    generateMetadata(pageProps("10", String(course.id), "x")),
  ).rejects.toThrow("NEXT_NOT_FOUND")
})

test("notFound when the episode has no parent podcasts", async () => {
  const episode = mockEpisode([], { hasTranscript: false })
  await expect(
    Page(pageProps("10", String(episode.id), "episode-one")),
  ).rejects.toThrow("NEXT_NOT_FOUND")
})

/**
 * The transcript is fetched from its own endpoint, so it only reaches the
 * server-rendered HTML if the route prefetches it into the dehydrated state.
 * Drop the prefetch and nothing throws -- it is caught -- the transcript panel
 * just goes empty for crawlers while devtools still looks right.
 */
test("prefetches the transcript into the dehydrated state when the episode has one", async () => {
  const episode = mockEpisode([10], { hasTranscript: true })
  const transcript = { id: episode.id, transcript: "Some spoken words." }
  setMockResponse.get(urls.podcastEpisodes.transcript(episode.id), transcript)

  await Page(pageProps("10", String(episode.id), "episode-one"))

  expect(makeRequest).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "get",
      url: urls.podcastEpisodes.transcript(episode.id),
    }),
  )
  // dehydrate() receives the very client the route prefetched into, so its
  // cache is what HydrationBoundary serializes into the HTML.
  const queryClient = jest.mocked(dehydrate).mock.calls[0][0]
  expect(
    queryClient.getQueryData(
      podcastEpisodeQueries.transcript(episode.id).queryKey,
    ),
  ).toEqual(transcript)
})

test("issues no transcript request when the episode has none", async () => {
  const episode = mockEpisode([10], { hasTranscript: false })

  await Page(pageProps("10", String(episode.id), "episode-one"))

  expect(makeRequest).not.toHaveBeenCalledWith(
    expect.objectContaining({
      url: urls.podcastEpisodes.transcript(episode.id),
    }),
  )
})
