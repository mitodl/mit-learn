import { faker } from "@faker-js/faker/locale/en"
import { generateSitemaps, default as sitemap } from "./sitemap"
import { setMockResponse, urls, factories } from "api/test-utils"
import { ResourceTypeEnum } from "api"

const RESOURCE_TYPES = [ResourceTypeEnum.Video, ResourceTypeEnum.VideoPlaylist]

describe("Video Sitemaps", () => {
  it("returns expected sitemap params", async () => {
    const pages = faker.number.int({ min: 4, max: 6 })
    const resources = factories.learningResources.resources({
      count: pages * 1_000 - 350,
      pageSize: 10,
    })

    setMockResponse.get(
      urls.learningResources.list({
        limit: 1_000,
        resource_type: RESOURCE_TYPES,
      }),
      resources,
    )

    const result = await generateSitemaps()
    expect(result).toHaveLength(pages)
    expect(result).toEqual(
      new Array(pages).fill(null).map((_, index) => ({
        id: index,
        location: `http://test.learn.odl.local:8062/sitemaps/video/sitemap/${index}.xml`,
      })),
    )
  })

  it("generates expected URLs for video and video playlist resources", async () => {
    const page = faker.number.int({ min: 5, max: 10 })
    const videoList = factories.learningResources.videos({
      count: 3,
      pageSize: 3,
    })
    const playlistList = factories.learningResources.videoPlaylists({
      count: 2,
      pageSize: 2,
    })
    const results = [...videoList.results, ...playlistList.results]

    setMockResponse.get(
      urls.learningResources.list({
        limit: 1_000,
        offset: page * 1_000,
        resource_type: RESOURCE_TYPES,
      }),
      { count: results.length, next: null, previous: null, results },
    )

    const sitemapPage = await sitemap({ id: String(page) })
    expect(sitemapPage).toEqual(
      results.map((resource) => {
        if (resource.resource_type === ResourceTypeEnum.VideoPlaylist) {
          return {
            url: `http://test.learn.odl.local:8062/video-playlist/${resource.id}`,
            lastModified: resource.last_modified ?? undefined,
          }
        }
        return {
          url: `http://test.learn.odl.local:8062/video/${resource.id}`,
          lastModified: resource.last_modified ?? undefined,
        }
      }),
    )
  })
})
