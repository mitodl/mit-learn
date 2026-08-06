import { factories, setMockResponse, urls } from "api/test-utils"
import { nextNavigationMocks } from "ol-test-utilities/mocks/nextNavigation"
import { resourceDrawerSearch } from "@/common/urls"
import { generateMetadata } from "./page"

jest.mock("@/app/getQueryClient", () => {
  const { makeBrowserQueryClient } = jest.requireActual("@/app/getQueryClient")
  return { getQueryClient: () => makeBrowserQueryClient({ maxRetries: 0 }) }
})

/**
 * content_type is not in the factory's defaults, and the page not-founds
 * anything that isn't "news".
 */
const mockNews = (slug: string) => {
  const content = factories.websiteContent.websiteContent({
    content_type: "news",
  })
  setMockResponse.get(urls.websiteContent.detailRetrieve(slug), content)
  return content
}

const pageProps = (
  slugOrId: string,
  searchParams: Record<string, string> = {},
) => ({
  params: Promise.resolve({ slugOrId }),
  searchParams: Promise.resolve(searchParams),
})

test("no resource param: metadata comes from the article", async () => {
  const content = mockNews("some-news")

  const meta = await generateMetadata(pageProps("some-news"))

  expect(meta.title).toContain(content.title)
  expect(meta.alternates?.canonical).toBeUndefined()
})

test("resolving resource param: canonical, title, description and image come from the resource", async () => {
  mockNews("some-news")
  const resource = factories.learningResources.resource()
  setMockResponse.get(
    urls.learningResources.details({ id: resource.id }),
    resource,
  )

  const meta = await generateMetadata(
    pageProps("some-news", { resource: String(resource.id) }),
  )

  expect(meta.title).toContain(resource.title)
  expect(meta.description).toContain(resource.description)
  expect(meta.openGraph?.images).toEqual([
    expect.objectContaining({
      url: resource.image?.url,
      alt: resource.image?.alt,
    }),
  ])
  expect(meta.alternates?.canonical).toContain(
    resourceDrawerSearch(resource.id, resource.title),
  )
})

test("dead resource param: the article not-founds", async () => {
  mockNews("some-news")
  setMockResponse.get(urls.learningResources.details({ id: 999999 }), null, {
    code: 404,
  })

  await generateMetadata(pageProps("some-news", { resource: "999999" }))

  expect(nextNavigationMocks.notFound).toHaveBeenCalled()
})
