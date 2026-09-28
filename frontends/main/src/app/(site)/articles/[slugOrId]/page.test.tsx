import { factories, setMockResponse, urls } from "api/test-utils"
import { generateMetadata } from "./page"

jest.mock("@/app/getQueryClient", () => {
  const { makeBrowserQueryClient } = jest.requireActual("@/app/getQueryClient")
  return { getQueryClient: () => makeBrowserQueryClient({ maxRetries: 0 }) }
})

/**
 * getMetadataAsync's own behavior is covered by common/metadata.test.ts and by
 * the news page's tests. What's specific to this route is its wiring, which was
 * hand-copied from news: that it passes the article through, and that it passes
 * searchParams through. Those need one case each — a resolving resource
 * overrides everything the article supplied, so neither case can pin both.
 */
const mockArticle = (slug: string) => {
  const content = factories.websiteContent.websiteContent({
    content_type: "article",
  })
  setMockResponse.get(urls.websiteContent.detailRetrieve(slug), content)
  return content
}

test("no resource param: metadata comes from the article", async () => {
  const content = mockArticle("some-article")

  const meta = await generateMetadata({
    params: Promise.resolve({ slugOrId: "some-article" }),
    searchParams: Promise.resolve({}),
  })

  expect(meta.title).toContain(content.title)
})

test("resolving resource param: canonical points at the resource", async () => {
  mockArticle("some-article")
  const resource = factories.learningResources.resource()
  setMockResponse.get(
    urls.learningResources.details({ id: resource.id }),
    resource,
  )

  const meta = await generateMetadata({
    params: Promise.resolve({ slugOrId: "some-article" }),
    searchParams: Promise.resolve({ resource: String(resource.id) }),
  })

  // The drawer canonicalizes to the resource's location on Learn, whatever page
  // it is opened over.
  expect(meta.alternates?.canonical).toBe(resource.learn_url)
})
