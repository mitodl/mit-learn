import { faker } from "@faker-js/faker/locale/en"
import { generateSitemaps, default as sitemap } from "./sitemap"
import { setMockResponse, makeRequest, urls, factories } from "api/test-utils"
import { ResourceTypeEnum } from "api"
import { resourceDrawerSearch } from "@/common/urls"

const { resourceSummaries } = factories.learningResources

/**
 * The types whose only canonical URL is the drawer, so the drawer URL is theirs
 * to submit.
 */
const RESOURCE_TYPES = [
  ResourceTypeEnum.Course,
  ResourceTypeEnum.Program,
  ResourceTypeEnum.LearningPath,
  ResourceTypeEnum.Document,
]

/**
 * Types with a dedicated page, submitted by ../video/sitemap.ts and
 * ../podcast/sitemap.ts. A drawer URL for one of these would be a second
 * self-canonical URL for the same content.
 */
const DEDICATED_PAGE_TYPES = [
  ResourceTypeEnum.Video,
  ResourceTypeEnum.VideoPlaylist,
  ResourceTypeEnum.Podcast,
  ResourceTypeEnum.PodcastEpisode,
]

const lastRequestedUrl = () => {
  const lastCall = makeRequest.mock.calls.at(-1)
  if (!lastCall) throw new Error("Expected the sitemap to call the API")
  return lastCall[0].url
}

/**
 * The count query and the page query must filter identically, or the shard
 * count stops matching the rows the shards emit. Asserted on both.
 */
const expectDrawerOnlyTypeFilter = (url: string) => {
  RESOURCE_TYPES.forEach((resourceType) => {
    expect(url).toContain(`resource_type=${resourceType}`)
  })
  DEDICATED_PAGE_TYPES.forEach((resourceType) => {
    expect(url).not.toContain(`resource_type=${resourceType}`)
  })
}

describe("Resource Sitemaps", () => {
  it("returns expected sitemap params", async () => {
    // Mock API response with fewer resources than TRY_FOR_PAGE_SIZE
    const pages = faker.number.int({ min: 4, max: 6 })
    const summaries = resourceSummaries({
      count: pages * 1_000 - 350,
      pageSize: 10, // should be 1_000, but let's keep it small for test
    })

    setMockResponse.get(
      urls.learningResources.summaryList({
        limit: 1_000,
        resource_type: RESOURCE_TYPES,
      }),
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
    // The shard count comes from a count that excludes the dedicated-page types.
    expectDrawerOnlyTypeFilter(lastRequestedUrl())
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
        resource_type: RESOURCE_TYPES,
      }),
      summaries,
    )

    const sitemapPage = await sitemap({ id: Promise.resolve(String(page)) })
    expect(sitemapPage).toEqual(
      summaries.results.map((resource) => ({
        // "&" must be pre-escaped: NextJS inserts urls into <loc> tags verbatim
        url: `http://test.learn.odl.local:8062${resourceDrawerSearch(
          resource.id,
          resource.title,
        )}`.replaceAll("&", "&amp;"),
        lastModified: resource.last_modified ?? undefined,
      })),
    )
    // guard against the escape being vacuous (no multi-param urls generated)
    expect(sitemapPage[0].url).toContain("&amp;resource_title=")
    // A resource with a dedicated page is never submitted as a drawer URL.
    expectDrawerOnlyTypeFilter(lastRequestedUrl())
    // No URL repeats within a single sitemap.
    expect(new Set(sitemapPage.map((entry) => entry.url)).size).toBe(
      sitemapPage.length,
    )
  })
})
