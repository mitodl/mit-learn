import { NextResponse } from "next/server"
import invariant from "tiny-invariant"
import * as resourceSitemap from "../resources/sitemap"
import * as channelsSitemap from "../channels/sitemap"

invariant(process.env.NEXT_PUBLIC_ORIGIN, "NEXT_PUBLIC_ORIGIN must be defined")
const BASE_URL: string = process.env.NEXT_PUBLIC_ORIGIN

export async function GET() {
  const content = await buildSitemapIndex()
  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Length": Buffer.byteLength(content).toString(),
    },
  })
}

async function buildSitemapIndex(): Promise<string> {
  const sitemaps = await Promise.all([
    resourceSitemap.generateSitemaps(),
    channelsSitemap.generateSitemaps(),
  ])
  const sitemapUrls = [
    `${BASE_URL}/sitemaps/static/sitemap.xml`,
    ...sitemaps.flatMap((sitemap) =>
      sitemap.map((sitemapItem) => sitemapItem.location),
    ),
  ]

  return formatSitemapIndex(sitemapUrls)
}

function formatSitemapIndex(sitemapUrls: string[]) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>'
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'

  for (const sitemapURL of sitemapUrls) {
    xml += "<sitemap>"
    xml += `<loc>${sitemapURL}</loc>`
    xml += "</sitemap>"
  }

  xml += "</sitemapindex>"
  return xml
}

/**
 * By default in NextJS, this route would be statically generated at build time
 * since it does not access a [dynamic api](https://nextjs.org/docs/app/guides/caching#dynamic-apis)
 * We force it to be rendered for each request; caching headers are set in next.config.js
 */
export const dynamic = "force-dynamic"
