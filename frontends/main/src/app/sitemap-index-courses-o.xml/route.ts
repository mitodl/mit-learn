import { requiredEnv } from "@/env"
import { NextResponse } from "next/server"
import { getQueryClient } from "@/app/getQueryClient"
import { learningResourceQueries } from "api/hooks/learningResources"
import {
  LearningResourcesSummaryListPlatformEnum,
  LearningResourcesSummaryListResourceTypeEnum,
} from "api"
import { escapeSitemapUrl } from "../sitemaps/util"

const PAGE_SIZE = 1_000

/**
 * Sitemap index listing the sitemap of every published OCW course, served at
 * /sitemap-index-courses-o.xml.
 *
 * Hugo builds each course's sitemap.xml and Fastly serves /courses/o/ straight
 * from the OCW course bucket, so this route only lists them. It has to stay at
 * the site root: crawlers only accept sitemaps in the same directory as their
 * index or below it, so neither /sitemaps/ nor /courses/o/ (not served by
 * NextJS) can hold it.
 *
 * Built from Learn's OCW course data, which Studio's publish and unpublish
 * webhooks keep current, so it lists the courses that search shows. A course
 * missing here is missing from search too, which is an ETL problem.
 */
export async function GET() {
  const content = await buildSitemapIndex()
  return new NextResponse(content, {
    headers: { "Content-Type": "application/xml" },
  })
}

/**
 * Every published OCW course. Throws if any page fails: a short index would
 * tell crawlers the missing courses' sitemaps are gone, while an error lets the
 * CDN keep serving its last good copy (stale-if-error).
 */
const fetchOcwCourses = async () => {
  const queryClient = getQueryClient()
  const fetchPage = (page: number) =>
    queryClient.fetchQuery(
      learningResourceQueries.summaryList({
        platform: [LearningResourcesSummaryListPlatformEnum.Ocw],
        resource_type: [LearningResourcesSummaryListResourceTypeEnum.Course],
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    )
  const first = await fetchPage(0)
  const pageCount = Math.ceil(first.count / PAGE_SIZE)
  const rest = await Promise.all(
    Array.from({ length: Math.max(pageCount - 1, 0) }, (_, i) =>
      fetchPage(i + 1),
    ),
  )
  return [first, ...rest].flatMap((page) => page.results)
}

/**
 * A course's URL is its OCW page today (https://ocw.mit.edu/courses/<slug>/).
 * Learn may store the /courses/o/<slug>/ URL instead later, and RC stores some
 * courses on live-qa.ocw.mit.edu, so only the path is read.
 */
const COURSE_PATH = /^\/courses\/(?:o\/)?([^/]+)\/?$/

const courseSlug = (url: string): string | null => {
  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    return null
  }
  return COURSE_PATH.exec(pathname)?.[1] ?? null
}

type SitemapIndexEntry = { loc: string; lastmod?: string }

async function buildSitemapIndex(): Promise<string> {
  // Read at request time so this works in the standalone Docker image where
  // NEXT_PUBLIC_ORIGIN is injected by Kubernetes, not baked at build time.
  // Crawlers only accept child sitemaps on the index's own host, so every
  // course sitemap is listed under this origin, whatever host its URL names.
  const BASE_URL = requiredEnv("NEXT_PUBLIC_ORIGIN")
  const courses = await fetchOcwCourses()

  // Keyed by slug: two resources with the same slug share one sitemap.
  const entries = new Map<string, SitemapIndexEntry>()
  for (const course of courses) {
    const slug = courseSlug(course.url ?? "")
    if (slug === null || entries.has(slug)) continue
    entries.set(slug, {
      loc: `${BASE_URL}/courses/o/${slug}/sitemap.xml`,
      // The publish time of the course, which is when Hugo rebuilt its sitemap.
      lastmod: course.last_modified ?? undefined,
    })
  }
  return formatSitemapIndex(entries.values())
}

function formatSitemapIndex(entries: Iterable<SitemapIndexEntry>) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>'
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'

  for (const { loc, lastmod } of entries) {
    xml += "<sitemap>"
    xml += `<loc>${escapeSitemapUrl(loc)}</loc>`
    if (lastmod) {
      xml += `<lastmod>${escapeSitemapUrl(lastmod)}</lastmod>`
    }
    xml += "</sitemap>"
  }

  xml += "</sitemapindex>"
  return xml
}

/**
 * Rendered for each request, like /sitemaps/sitemap-index.xml. Caching headers
 * (Cache-Control and the "html-pages" Surrogate-Key) are set at runtime in
 * src/proxy.ts.
 */
export const dynamic = "force-dynamic"
