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

const pageProps = (podcastId: string) => ({
  params: Promise.resolve({ podcastId }),
  searchParams: Promise.resolve({}),
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

test("notFound for a non-numeric id", async () => {
  await expect(Page(pageProps("abc"))).rejects.toThrow("NEXT_NOT_FOUND")
})
