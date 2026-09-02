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
jest.mock("@/app-pages/PodcastPage/PodcastDetailPage", () => ({
  PodcastDetailPage: () => null,
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

const ORIGIN = "http://test.learn.odl.local:8062"

/**
 * The backend names the canonical URL, so a test asserting on it must say what
 * the backend returned. `slug` is the segment learn_url carries.
 */
const mockPodcast = (slug = "beyond-biology") => {
  const id = 1234
  const podcast = factories.learningResources.podcast({
    id,
    title: "Beyond Biology",
    learn_url: `${ORIGIN}/podcast/${id}/${slug}`,
  })
  setMockResponse.get(
    urls.learningResources.details({ id: podcast.id }),
    podcast,
  )
  return podcast
}

const pageProps = (podcastId: string, slug: string) => ({
  params: Promise.resolve({ podcastId, slug }),
  searchParams: Promise.resolve({}),
})

test("renders (no redirect) when the slug is already canonical", async () => {
  const podcast = mockPodcast()
  await Page(pageProps(String(podcast.id), "beyond-biology"))
  expect(mockRedirect).not.toHaveBeenCalled()
})

test("redirects a stale/wrong slug to the canonical", async () => {
  const podcast = mockPodcast()
  await expect(
    Page(pageProps(String(podcast.id), "old-title")),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/podcast/${podcast.id}/beyond-biology`,
  )
})

test("notFound for a non-numeric id", async () => {
  await expect(Page(pageProps("abc", "x"))).rejects.toThrow("NEXT_NOT_FOUND")
})

test("honours the literal 'resource' segment for a title that has no slug", async () => {
  // A digits-only title slugs to nothing, so the backend emits "resource".
  const podcast = mockPodcast("resource")
  await expect(Page(pageProps(String(podcast.id), "wrong"))).rejects.toThrow(
    "NEXT_REDIRECT",
  )
  expect(mockRedirect).toHaveBeenCalledWith(`/podcast/${podcast.id}/resource`)
})

test("generateMetadata sets the slugged canonical tag", async () => {
  const podcast = mockPodcast()
  const meta = await generateMetadata(
    pageProps(String(podcast.id), "beyond-biology"),
  )
  expect(meta.alternates?.canonical).toMatch(
    new RegExp(`/podcast/${podcast.id}/beyond-biology$`),
  )
})
