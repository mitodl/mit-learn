import { faker } from "@faker-js/faker/locale/en"
import { generateSitemaps, default as sitemap } from "./sitemap"
import { setMockResponse, urls, factories } from "api/test-utils"
import { ResourceTypeEnum } from "api"

const { resourceSummaries, resourceSummary } = factories.learningResources

describe("Resource Sitemaps", () => {
  it("returns expected sitemap params", async () => {
    const pages = faker.number.int({ min: 4, max: 6 })
    const summaries = resourceSummaries({
      count: pages * 1_000 - 350,
      pageSize: 10, // should be 1_000, but let's keep it small for test
    })

    setMockResponse.get(
      urls.learningResources.summaryList({ limit: 1 }),
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

  it("submits each resource under its learn_url", async () => {
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

    const sitemapPage = await sitemap({ id: Promise.resolve(String(page)) })

    expect(sitemapPage).toEqual(
      summaries.results.map((resource) => ({
        // "&" must be pre-escaped: NextJS inserts urls into <loc> tags verbatim
        url: resource.learn_url.replaceAll("&", "&amp;"),
        lastModified: resource.last_modified ?? undefined,
      })),
    )
  })

  /**
   * The whole point of driving this from learn_url: a resource with a dedicated
   * page is submitted under that page, not under a drawer URL that would compete
   * with it. The backend decides, so the sitemap needs no per-type branching.
   */
  it.each([
    {
      page: 20,
      resourceType: ResourceTypeEnum.Video,
      learnUrl:
        "http://test.learn.odl.local:8062/video/6395/lecture-11?playlist=6384",
    },
    {
      page: 21,
      resourceType: ResourceTypeEnum.PodcastEpisode,
      learnUrl:
        "http://test.learn.odl.local:8062/podcast/14144/podcast_episode/14145/ep-4",
    },
    {
      page: 22,
      resourceType: ResourceTypeEnum.Course,
      learnUrl:
        "http://test.learn.odl.local:8062/courses/course-v1:MITxT+14.100x",
    },
    {
      page: 23,
      resourceType: ResourceTypeEnum.Program,
      learnUrl: "http://test.learn.odl.local:8062/search?resource=99",
    },
  ])(
    "emits the learn_url for $resourceType",
    async ({ page, resourceType, learnUrl }) => {
      const resource = resourceSummary({
        resource_type: resourceType,
        learn_url: learnUrl,
      })

      setMockResponse.get(
        urls.learningResources.summaryList({
          limit: 1_000,
          offset: page * 1_000,
        }),
        { count: 1, next: null, previous: null, results: [resource] },
      )

      const sitemapPage = await sitemap({ id: Promise.resolve(String(page)) })

      expect(sitemapPage).toEqual([
        {
          url: learnUrl.replaceAll("&", "&amp;"),
          lastModified: resource.last_modified ?? undefined,
        },
      ])
    },
  )

  it("submits no resource more than once", async () => {
    const results = [
      resourceSummary({ resource_type: ResourceTypeEnum.Video }),
      resourceSummary({ resource_type: ResourceTypeEnum.PodcastEpisode }),
      resourceSummary({ resource_type: ResourceTypeEnum.Course }),
    ]

    setMockResponse.get(
      urls.learningResources.summaryList({ limit: 1_000, offset: 30_000 }),
      { count: results.length, next: null, previous: null, results },
    )

    const sitemapPage = await sitemap({ id: Promise.resolve("30") })

    expect(sitemapPage).toHaveLength(results.length)
    expect(new Set(sitemapPage.map((entry) => entry.url)).size).toBe(
      results.length,
    )
  })
})
