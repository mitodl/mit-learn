import { notFound, redirect } from "next/navigation"
import { factories, setMockResponse, urls } from "api/test-utils"
import Page from "./page"

jest.mock("@/app/getQueryClient", () => {
  const { makeBrowserQueryClient } = jest.requireActual("@/app/getQueryClient")
  return { getQueryClient: () => makeBrowserQueryClient({ maxRetries: 0 }) }
})

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

const pageProps = (
  podcastId: string,
  searchParams: Record<string, string> = {},
) => ({
  params: Promise.resolve({ podcastId }),
  searchParams: Promise.resolve(searchParams),
})

test("bare podcast id redirects to the slugged canonical", async () => {
  const podcast = factories.learningResources.podcast({
    title: "Beyond Biology",
  })
  setMockResponse.get(
    urls.learningResources.details({ id: podcast.id }),
    podcast,
  )
  await expect(Page(pageProps(String(podcast.id)))).rejects.toThrow(
    "NEXT_REDIRECT",
  )
  expect(mockRedirect).toHaveBeenCalledWith(
    `/podcast/${podcast.id}/beyond-biology`,
  )
})

test("redirect carries incoming query params (e.g. utm)", async () => {
  const podcast = factories.learningResources.podcast({
    title: "Beyond Biology",
  })
  setMockResponse.get(
    urls.learningResources.details({ id: podcast.id }),
    podcast,
  )
  await expect(
    Page(pageProps(String(podcast.id), { utm_source: "newsletter" })),
  ).rejects.toThrow("NEXT_REDIRECT")
  expect(mockRedirect).toHaveBeenCalledWith(
    `/podcast/${podcast.id}/beyond-biology?utm_source=newsletter`,
  )
})

test("notFound for a non-numeric id", async () => {
  await expect(Page(pageProps("abc"))).rejects.toThrow("NEXT_NOT_FOUND")
})

// The bare-id pages share this guard structurally; one representative case.
test("notFound for a resource that is not a podcast", async () => {
  const course = factories.learningResources.course()
  setMockResponse.get(urls.learningResources.details({ id: course.id }), course)
  await expect(Page(pageProps(String(course.id)))).rejects.toThrow(
    "NEXT_NOT_FOUND",
  )
})
