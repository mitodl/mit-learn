import { faker } from "@faker-js/faker/locale/en"
import { generateSitemaps, default as sitemap } from "./sitemap"
import { setMockResponse, urls, factories } from "api/test-utils"
import { ResourceTypeEnum } from "api"

const RESOURCE_TYPES = [
  ResourceTypeEnum.Podcast,
  ResourceTypeEnum.PodcastEpisode,
]

describe("Podcast Sitemaps", () => {
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
        location: `http://test.learn.odl.local:8062/sitemaps/podcast/sitemap/${index}.xml`,
      })),
    )
  })

  it("generates expected URLs for podcast resources", async () => {
    const page = faker.number.int({ min: 5, max: 10 })
    const podcastList = factories.learningResources.podcasts({
      count: 3,
      pageSize: 3,
    })

    setMockResponse.get(
      urls.learningResources.list({
        limit: 1_000,
        offset: page * 1_000,
        resource_type: RESOURCE_TYPES,
      }),
      podcastList,
    )

    const sitemapPage = await sitemap({ id: String(page) })
    expect(sitemapPage).toEqual(
      podcastList.results.map((resource) => ({
        url: `http://test.learn.odl.local:8062/podcast/${resource.id}`,
        lastModified: resource.last_modified ?? undefined,
      })),
    )
  })

  it("generates expected URLs for podcast episode resources", async () => {
    const page = faker.number.int({ min: 5, max: 10 })
    const parentPodcastId = String(faker.number.int())
    const episodeWithParent = factories.learningResources.podcastEpisode({
      podcast_episode: { podcasts: [parentPodcastId] },
    })
    const episodeWithoutParent = factories.learningResources.podcastEpisode({
      podcast_episode: { podcasts: [] },
    })
    const results = [episodeWithParent, episodeWithoutParent]

    setMockResponse.get(
      urls.learningResources.list({
        limit: 1_000,
        offset: page * 1_000,
        resource_type: RESOURCE_TYPES,
      }),
      { count: results.length, next: null, previous: null, results },
    )

    const sitemapPage = await sitemap({ id: String(page) })
    // episodeWithoutParent should be excluded
    expect(sitemapPage).toEqual([
      {
        url: `http://test.learn.odl.local:8062/podcast/${parentPodcastId}/podcast_episode/${episodeWithParent.id}`,
        lastModified: episodeWithParent.last_modified ?? undefined,
      },
    ])
  })
})
