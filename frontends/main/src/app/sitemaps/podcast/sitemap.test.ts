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
    const summaries = factories.learningResources.resourceSummaries({
      count: pages * 1_000 - 350,
      pageSize: 1,
    })

    setMockResponse.get(
      urls.learningResources.summaryList({
        limit: 1,
        resource_type: RESOURCE_TYPES,
      }),
      summaries,
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
    // Use a non-overlapping range from the podcast test (which uses { min: 5, max: 10 })
    // to avoid query cache collisions on the same list URL.
    const page = faker.number.int({ min: 11, max: 20 })
    const podcastId1 = String(faker.number.int())
    const podcastId2 = String(faker.number.int())
    const episodeWithMultipleParents =
      factories.learningResources.podcastEpisode({
        podcast_episode: { podcasts: [podcastId1, podcastId2] },
      })
    const episodeWithOneParent = factories.learningResources.podcastEpisode({
      podcast_episode: { podcasts: [podcastId1] },
    })
    const episodeWithoutParent = factories.learningResources.podcastEpisode({
      podcast_episode: { podcasts: [] },
    })
    const results = [
      episodeWithMultipleParents,
      episodeWithOneParent,
      episodeWithoutParent,
    ]

    setMockResponse.get(
      urls.learningResources.list({
        limit: 1_000,
        offset: page * 1_000,
        resource_type: RESOURCE_TYPES,
      }),
      { count: results.length, next: null, previous: null, results },
    )

    const sitemapPage = await sitemap({ id: String(page) })
    // episodeWithoutParent should be excluded; episodeWithMultipleParents emits one entry per parent
    expect(sitemapPage).toEqual([
      {
        url: `http://test.learn.odl.local:8062/podcast/${podcastId1}/podcast_episode/${episodeWithMultipleParents.id}`,
        lastModified: episodeWithMultipleParents.last_modified ?? undefined,
      },
      {
        url: `http://test.learn.odl.local:8062/podcast/${podcastId2}/podcast_episode/${episodeWithMultipleParents.id}`,
        lastModified: episodeWithMultipleParents.last_modified ?? undefined,
      },
      {
        url: `http://test.learn.odl.local:8062/podcast/${podcastId1}/podcast_episode/${episodeWithOneParent.id}`,
        lastModified: episodeWithOneParent.last_modified ?? undefined,
      },
    ])
  })
})
