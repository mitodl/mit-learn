import { faker } from "@faker-js/faker/locale/en"
import { generateSitemaps, default as sitemap } from "./sitemap"
import { setMockResponse, urls, factories } from "api/test-utils"

const { channels: makeChannels } = factories.channels

describe("Resource Sitemaps", () => {
  it("returns expected sitemap configuration for small datasets", async () => {
    const pages = faker.number.int({ min: 4, max: 6 })
    const channels = makeChannels({
      count: pages * 100 - 35,
      pageSize: 10, // should be 100, but let's keep it small for test
    })

    setMockResponse.get(urls.channels.list({ limit: 100 }), channels)

    const result = await generateSitemaps()

    expect(result).toHaveLength(pages)
    expect(result).toEqual(
      new Array(pages).fill(null).map((c, index) => ({
        id: index,
        location: `http://test.learn.odl.local:8062/sitemaps/channels/sitemap/${index}.xml`,
      })),
    )
  })

  it("generates expected sitemap given params from generateSitemaps", async () => {
    const page = faker.number.int({ min: 5, max: 10 })

    const channels = makeChannels({
      count: 750,
      pageSize: 5, // should be 100, but let's keep it small for test
    })

    setMockResponse.get(
      urls.channels.list({ limit: 100, offset: 100 * page }),
      channels,
    )

    const sitemapPage = await sitemap({
      id: String(page),
    })
    expect(sitemapPage).toEqual(
      channels.results.map((channel) => ({
        url: channel.channel_url,
      })),
    )
  })
})
