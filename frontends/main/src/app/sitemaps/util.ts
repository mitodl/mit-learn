import { PHASE_PRODUCTION_BUILD } from "next/constants"
import type { MetadataRoute } from "next"
import { NextResponse } from "next/server"
import type { GeneratedSitemapArgs } from "./types"

/**
 * This returns true DURING the production build. In other words:
 *
 * - false during development, (`next dev`)
 * - true during production build (`next build`)
 * - false when running the production server (`next start`)
 *
 * Avoid using this. Our code usually should not care whether it is running
 * during the build phase, and it's unclear whether this is part of NextJS's
 * public API.
 */
export const dangerouslyDetectProductionBuildPhase = () => {
  return process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
}

/**
 * NextJS serializes sitemap entries verbatim into <loc> tags with no XML
 * escaping (https://github.com/vercel/next.js/issues/77340), so a URL
 * containing "&" (e.g. one with multiple query params) produces invalid XML.
 * Escape XML special characters ourselves; crawlers decode entities, so
 * <loc>a&amp;b</loc> round-trips back to "a&b".
 *
 * NOTE: this relies on NextJS emitting the url verbatim. If NextJS ever
 * starts escaping <loc> itself, this would double-escape.
 */
export const escapeSitemapUrl = (url: string) =>
  url
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")

/**
 * Construct a paged sitemap route's default export (the counterpart of
 * `generateSitemaps`). Handles the NextJS plumbing every sitemap needs:
 *
 * - awaits the promised shard `id` and parses it ({@link GeneratedSitemapArgs})
 * - XML-escapes entry urls (see {@link escapeSitemapUrl})
 */
export const constructSitemap =
  (generate: (page: number) => Promise<MetadataRoute.Sitemap>) =>
  async ({ id }: GeneratedSitemapArgs): Promise<MetadataRoute.Sitemap> => {
    const page = +(await id)
    const entries = await generate(page)
    return entries.map((entry) => ({
      ...entry,
      url: escapeSitemapUrl(entry.url),
    }))
  }

export type SitemapIndexEntry = { loc: string; lastmod?: string }

const formatSitemapIndex = (entries: Iterable<SitemapIndexEntry>) => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>'
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  for (const { loc, lastmod } of entries) {
    xml += "<sitemap>"
    xml += `<loc>${escapeSitemapUrl(loc)}</loc>`
    if (lastmod) {
      xml += `<lastmod>${lastmod}</lastmod>`
    }
    xml += "</sitemap>"
  }
  xml += "</sitemapindex>"
  return xml
}

/**
 * Construct a sitemap index route's GET handler from the function that loads
 * its entries, so every index shares the same XML, escaping and headers.
 */
export const constructSitemapIndex =
  (getEntries: () => Promise<Iterable<SitemapIndexEntry>>) => async () =>
    new NextResponse(formatSitemapIndex(await getEntries()), {
      headers: { "Content-Type": "application/xml" },
    })
