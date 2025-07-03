import { faker } from "@faker-js/faker/locale/en"
import { generateSitemaps, default as sitemap } from "./sitemap"
import { setMockResponse, urls, factories } from "api/test-utils"

const { resourceSummaries } = factories.learningResources

describe("Resource Sitemaps", () => {
  it("returns expected sitemap params", async () => {
    // Mock API response with fewer resources than TRY_FOR_PAGE_SIZE
    const pages = faker.number.int({ min: 4, max: 6 })
    const summaries = resourceSummaries({
      count: pages * 1_000 - 350,
      pageSize: 10, // should be 1_000, but let's keep it small for test
    })

    setMockResponse.get(
      urls.learningResources.summaryList({ limit: 1_000 }),
      summaries,
    )

    const result = await generateSitemaps()

    expect(result).toHaveLength(pages)
    expect(result).toEqual(
      new Array(pages).fill(null).map((_, index) => ({
        id: index,
        location: `http://test.learn.odl.local:8062/sitemaps/resources/sitemap/${index}.xml`,
      })),
    )
  })

  it("generates expected sitemap/<id>", async () => {
    const page = faker.number.int({ min: 5, max: 10 })
    const summaries = resourceSummaries({
      count: 15_000,
      pageSize: 5, // should be 1_000, but let's keep it small for test
    })

    setMockResponse.get(
      urls.learningResources.summaryList({
        limit: 1_000,
        offset: page * 1_000,
      }),
      summaries,
    )

    const sitemapPage = await sitemap({ id: String(page) })
    expect(sitemapPage).toEqual(
      summaries.results.map((resource) => ({
        url: `http://test.learn.odl.local:8062/search?resource=${resource.id}`,
        lastModified: resource.last_modified ?? undefined,
      })),
    )
  })
})
