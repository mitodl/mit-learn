import { faker } from "@faker-js/faker/locale/en"
import { generateSitemaps, default as sitemap } from "./sitemap"
import { setMockResponse, urls, factories } from "api/test-utils"
import { PlatformEnum, ResourceTypeEnum } from "api"

const { resourceSummaries } = factories.learningResources

describe("Product Sitemaps", () => {
  it("returns expected sitemap params", async () => {
    const pages = faker.number.int({ min: 4, max: 6 })
    const summaries = resourceSummaries({
      count: pages * 1_000 - 350,
      pageSize: 10,
    })

    setMockResponse.get(
      urls.learningResources.summaryList({
        limit: 1_000,
        platform: [PlatformEnum.Mitxonline],
        resource_type: [ResourceTypeEnum.Course, ResourceTypeEnum.Program],
      }),
      summaries,
    )

    const result = await generateSitemaps()
    expect(result).toHaveLength(pages)
    expect(result).toEqual(
      new Array(pages).fill(null).map((_, index) => ({
        id: index,
        location: `http://test.learn.odl.local:8062/sitemaps/products/sitemap/${index}.xml`,
      })),
    )
  })

  it("generates expected sitemap/<id>", async () => {
    const page = faker.number.int({ min: 5, max: 10 })
    const summaries = resourceSummaries({
      count: 15_000,
      pageSize: 5,
    })
    summaries.results[0].url = null
    summaries.results[1].url =
      "http://test.learn.odl.local:8062/programs/program-1"

    setMockResponse.get(
      urls.learningResources.summaryList({
        limit: 1_000,
        offset: page * 1_000,
        platform: [PlatformEnum.Mitxonline],
        resource_type: [ResourceTypeEnum.Course, ResourceTypeEnum.Program],
      }),
      summaries,
    )

    const sitemapPage = await sitemap({ id: String(page) })
    expect(sitemapPage).toEqual(
      summaries.results
        .filter((resource) => Boolean(resource.url))
        .map((resource) => ({
          url: resource.url as string,
          lastModified: resource.last_modified ?? undefined,
        })),
    )
  })
})
