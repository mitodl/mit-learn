import { setMockResponse, urls, factories } from "api/test-utils"
import {
  LearningResourcesSummaryListPlatformEnum,
  LearningResourcesSummaryListResourceTypeEnum,
  type LearningResourceSummary,
} from "api"
import { getQueryClient } from "@/app/getQueryClient"
import { GET } from "./route"

const { resourceSummary } = factories.learningResources

const ORIGIN = "http://test.learn.odl.local:8062"

const ocwCoursesUrl = (offset: number) =>
  urls.learningResources.summaryList({
    platform: [LearningResourcesSummaryListPlatformEnum.Ocw],
    resource_type: [LearningResourcesSummaryListResourceTypeEnum.Course],
    limit: 1_000,
    offset,
  })

/** Mock one page of the OCW course summary list. */
const mockPage = (
  offset: number,
  count: number,
  results: LearningResourceSummary[],
) =>
  setMockResponse.get(ocwCoursesUrl(offset), {
    count,
    next: null,
    previous: null,
    results,
  })

const ocwCourse = (url: string, lastModified: string | null = null) =>
  resourceSummary({
    resource_type: LearningResourcesSummaryListResourceTypeEnum.Course,
    url,
    last_modified: lastModified,
  })

const courseSitemap = (slug: string) =>
  `${ORIGIN}/courses/o/${slug}/sitemap.xml`

/** Parse the index as XML, failing the test if it is not well-formed. */
const parseIndex = async (response: Response) => {
  const xml = await response.text()
  const doc = new DOMParser().parseFromString(xml, "application/xml")
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0)
  const root = doc.documentElement
  expect(root.localName).toBe("sitemapindex")
  expect(root.namespaceURI).toBe("http://www.sitemaps.org/schemas/sitemap/0.9")
  const entries = Array.from(root.getElementsByTagName("sitemap")).map(
    (sitemap) => ({
      loc: sitemap.getElementsByTagName("loc")[0]?.textContent,
      lastmod: sitemap.getElementsByTagName("lastmod")[0]?.textContent,
    }),
  )
  return { xml, entries }
}

describe("OCW course sitemap index", () => {
  beforeEach(() => {
    // Under jsdom getQueryClient() is a long-lived browser client, so a page
    // fetched by one test would otherwise answer the next test's request.
    getQueryClient().clear()
  })

  it("lists the course sitemap of every OCW course across all pages", async () => {
    mockPage(0, 2_001, [ocwCourse("https://ocw.mit.edu/courses/first/")])
    mockPage(1_000, 2_001, [ocwCourse("https://ocw.mit.edu/courses/second/")])
    mockPage(2_000, 2_001, [ocwCourse("https://ocw.mit.edu/courses/third/")])

    const { entries } = await parseIndex(await GET())

    expect(entries.map((entry) => entry.loc)).toEqual([
      courseSitemap("first"),
      courseSitemap("second"),
      courseSitemap("third"),
    ])
  })

  it("serves XML", async () => {
    mockPage(0, 0, [])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/xml")
  })

  it("is a valid empty index when there are no OCW courses", async () => {
    mockPage(0, 0, [])

    const { entries } = await parseIndex(await GET())

    expect(entries).toEqual([])
  })

  /**
   * Courses are stored under their OCW URL today. Learn may store the
   * /courses/o/ URL instead later, and RC stores some courses on
   * live-qa.ocw.mit.edu, so the slug is read from the path alone.
   */
  it.each([
    ["https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/"],
    ["https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010"],
    ["https://live-qa.ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/"],
    ["https://learn.mit.edu/courses/o/18-06-linear-algebra-spring-2010/"],
    ["https://learn.mit.edu/courses/o/18-06-linear-algebra-spring-2010"],
  ])("reads the course slug from %s", async (url) => {
    mockPage(0, 1, [ocwCourse(url)])

    const { entries } = await parseIndex(await GET())

    expect(entries.map((entry) => entry.loc)).toEqual([
      courseSitemap("18-06-linear-algebra-spring-2010"),
    ])
  })

  it("keeps dots in course slugs", async () => {
    mockPage(0, 1, [
      ocwCourse("https://ocw.mit.edu/courses/14.126-game-theory-spring-2024/"),
    ])

    const { entries } = await parseIndex(await GET())

    expect(entries.map((entry) => entry.loc)).toEqual([
      courseSitemap("14.126-game-theory-spring-2024"),
    ])
  })

  it("skips courses whose URL is not a course home page", async () => {
    mockPage(0, 6, [
      ocwCourse("https://ocw.mit.edu/"),
      ocwCourse("https://ocw.mit.edu/courses/"),
      ocwCourse("https://ocw.mit.edu/courses/some-course/pages/syllabus/"),
      ocwCourse("https://ocw.mit.edu/search/"),
      ocwCourse("not a url"),
      ocwCourse("https://ocw.mit.edu/courses/kept-course/"),
    ])

    const { entries } = await parseIndex(await GET())

    expect(entries.map((entry) => entry.loc)).toEqual([
      courseSitemap("kept-course"),
    ])
  })

  it("lists a course sitemap once when two courses share a slug", async () => {
    mockPage(0, 2, [
      ocwCourse("https://ocw.mit.edu/courses/same-course/"),
      ocwCourse("https://learn.mit.edu/courses/o/same-course/"),
    ])

    const { entries } = await parseIndex(await GET())

    expect(entries.map((entry) => entry.loc)).toEqual([
      courseSitemap("same-course"),
    ])
  })

  it("gives each course its last_modified as lastmod, and omits it when unknown", async () => {
    mockPage(0, 2, [
      ocwCourse("https://ocw.mit.edu/courses/dated/", "2026-11-04T18:27:04Z"),
      ocwCourse("https://ocw.mit.edu/courses/undated/", null),
    ])

    const { xml, entries } = await parseIndex(await GET())

    expect(entries).toEqual([
      { loc: courseSitemap("dated"), lastmod: "2026-11-04T18:27:04Z" },
      { loc: courseSitemap("undated"), lastmod: undefined },
    ])
    expect(xml.match(/<lastmod>/g)).toHaveLength(1)
  })

  it("escapes XML special characters in sitemap URLs", async () => {
    mockPage(0, 1, [ocwCourse("https://ocw.mit.edu/courses/a&b/")])

    const { xml, entries } = await parseIndex(await GET())

    expect(xml).toContain(`<loc>${courseSitemap("a&amp;b")}</loc>`)
    expect(entries.map((entry) => entry.loc)).toEqual([courseSitemap("a&b")])
  })

  /**
   * A short index would tell crawlers the missing courses' sitemaps are gone.
   * Failing lets the CDN keep serving the last good copy (stale-if-error).
   */
  it("fails instead of serving a partial index when a page cannot be fetched", async () => {
    mockPage(0, 1_500, [ocwCourse("https://ocw.mit.edu/courses/first/")])
    // A 404 is not retried, which keeps this test fast.
    setMockResponse.get(ocwCoursesUrl(1_000), {}, { code: 404 })

    await expect(GET()).rejects.toThrow()
  })
})
