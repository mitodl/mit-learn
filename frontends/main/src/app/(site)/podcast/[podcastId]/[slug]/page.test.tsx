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

const mockPodcast = () => {
  const podcast = factories.learningResources.podcast({
    title: "Beyond Biology",
  })
  setMockResponse.get(
    urls.learningResources.details({ id: podcast.id }),
    podcast,
  )
  return podcast
}

test("renders (no redirect) when the slug is already canonical", async () => {
  const podcast = mockPodcast()
  await Page({
    params: Promise.resolve({
      podcastId: String(podcast.id),
      slug: "beyond-biology",
    }),
  })
  expect(mockRedirect).not.toHaveBeenCalled()
})

test("redirects a stale/wrong slug to the canonical", async () => {
  const podcast = mockPodcast()
  await expect(
    Page({
      params: Promise.resolve({
        podcastId: String(podcast.id),
        slug: "old-title",
      }),
    }),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/podcast/${podcast.id}/beyond-biology`,
  )
})

test("notFound for a non-numeric id", async () => {
  await expect(
    Page({ params: Promise.resolve({ podcastId: "abc", slug: "x" }) }),
  ).rejects.toThrow("NEXT_NOT_FOUND")
})

test("a blank-slug title canonicalizes to the literal 'resource' segment", async () => {
  // Digits-only title → slugify() is blank → path uses the "resource" segment.
  const podcast = factories.learningResources.podcast({ title: "2024" })
  setMockResponse.get(
    urls.learningResources.details({ id: podcast.id }),
    podcast,
  )
  await expect(
    Page({
      params: Promise.resolve({ podcastId: String(podcast.id), slug: "wrong" }),
    }),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(`/podcast/${podcast.id}/resource`)
})

test("generateMetadata sets the slugged canonical tag", async () => {
  const podcast = mockPodcast()
  const meta = await generateMetadata({
    params: Promise.resolve({
      podcastId: String(podcast.id),
      slug: "beyond-biology",
    }),
  })
  expect(meta.alternates?.canonical).toMatch(
    new RegExp(`/podcast/${podcast.id}/beyond-biology$`),
  )
})
