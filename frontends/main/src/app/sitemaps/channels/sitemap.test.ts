import { faker } from "@faker-js/faker/locale/en"
import { generateSitemaps, default as sitemap } from "./sitemap"
import { setMockResponse, urls, factories } from "api/test-utils"

const { channels: makeChannels } = factories.channels

describe("Resource Sitemaps", () => {
  it("returns expected sitemap configuration for small datasets", async () => {
    // Mock API response with fewer resources than TRY_FOR_PAGE_SIZE
    const pageSize = faker.number.int({ min: 8, max: 10 })
    const pages = faker.number.int({ min: 4, max: 6 })
    const channels = makeChannels({
      count: pageSize * pages - 2,
      pageSize,
    })

    setMockResponse.get(urls.channels.list({ limit: 100 }), channels)

    const result = await generateSitemaps()

    expect(result).toHaveLength(pages)
    expect(result).toEqual(
      new Array(pages).fill(null).map((c, index) => ({
        id: index,
        limit: pageSize,
        offset: index * pageSize,
        location: `http://test.learn.odl.local:8062/sitemaps/channels/sitemap/${index}.xml`,
      })),
    )
  })

  it("generates expected sitemap given params from generateSitemaps", async () => {
    const offset = faker.number.int({ min: 0, max: 100 })
    // First, set up generateSitemaps to return some params
    const pageSize = 5
    const channels = makeChannels({
      count: 200,
      pageSize,
    })

    setMockResponse.get(
      urls.channels.list({ limit: pageSize, offset }),
      channels,
    )

    const sitemapPage = await sitemap({
      limit: pageSize,
      offset,
      id: 3,
      location: "whatever",
    })
    expect(sitemapPage).toEqual(
      channels.results.map((channel) => ({
        url: channel.channel_url,
      })),
    )
  })
})
