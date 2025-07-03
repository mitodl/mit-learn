import { faker } from "@faker-js/faker/locale/en"
import { generateSitemaps, default as sitemap } from "./sitemap"
import { setMockResponse, urls, factories } from "api/test-utils"

const { resourceSummaries } = factories.learningResources

describe("Resource Sitemaps", () => {
  it("returns expected sitemap configuration for small datasets", async () => {
    // Mock API response with fewer resources than TRY_FOR_PAGE_SIZE
    const pageSize = faker.number.int({ min: 8, max: 10 })
    const pages = faker.number.int({ min: 4, max: 6 })
    const summaries = resourceSummaries({
      count: pageSize * pages - 2,
      pageSize,
    })

    setMockResponse.get(
      urls.learningResources.summaryList({ limit: 10_000 }),
      summaries,
    )

    const result = await generateSitemaps()

    expect(result).toHaveLength(pages)
    expect(result).toEqual(
      new Array(pages).fill(null).map((_, index) => ({
        id: index,
        limit: pageSize,
        offset: index * pageSize,
        location: `http://test.learn.odl.local:8062/sitemaps/resources/sitemap/${index}.xml`,
      })),
    )
  })

  it("generates expected sitemap GIVEN params from generateSitemaps", async () => {
    const offset = faker.number.int({ min: 0, max: 100 })
    // First, set up generateSitemaps to return some params
    const pageSize = 5
    const summaries = resourceSummaries({
      count: 200,
      pageSize,
    })

    setMockResponse.get(
      urls.learningResources.summaryList({ limit: pageSize, offset }),
      summaries,
    )

    const sitemapPage = await sitemap({
      limit: pageSize,
      offset,
      id: 3,
      location: "whatever",
    })
    expect(sitemapPage).toEqual(
      summaries.results.map((resource) => ({
        url: `http://test.learn.odl.local:8062/search?resource=${resource.id}`,
        lastModified: resource.last_modified ?? undefined,
      })),
    )
  })
})
