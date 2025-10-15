import type { MetadataRoute } from "next"
import invariant from "tiny-invariant"
import type { GenerateSitemapResult } from "../types"
import { dangerouslyDetectProductionBuildPhase } from "../util"
import { getServerQueryClient } from "api/ssr/serverQueryClient"
import { channelQueries } from "api/hooks/channels"

const BASE_URL = process.env.NEXT_PUBLIC_ORIGIN
invariant(BASE_URL, "NEXT_PUBLIC_ORIGIN must be defined")

const PAGE_SIZE = 100

/**
 * By default in NextJS, sitemaps are statically generated at build time.
 * We want to ensure up-to-date sitemaps.
 *
 * This forces the sitemaps to be rendered for each request.
 * However, we we set s-maxage in the headers (next.config.js) to enable caching
 * by a CDN.
 */
export const dynamic = "force-dynamic"

export async function generateSitemaps(): Promise<GenerateSitemapResult[]> {
  /**
   * NextJS runs this at build time (despite force-dynamic below).
   * Early exist here to avoid the useless build-time API calls.
   */
  if (dangerouslyDetectProductionBuildPhase()) return []
  const queryClient = getServerQueryClient()
  const { count } = await queryClient.fetchQuery(
    channelQueries.list({ limit: PAGE_SIZE }),
  )

  const pages = Math.ceil(count / PAGE_SIZE)
  return new Array(pages).fill(null).map((_, index) => ({
    id: index,
    location: `${BASE_URL}/sitemaps/channels/sitemap/${index}.xml`,
  }))
}

export default async function sitemap({
  id,
}: {
  id: string
}): Promise<MetadataRoute.Sitemap> {
  const queryClient = getServerQueryClient()
  const data = await queryClient.fetchQuery(
    channelQueries.list({
      limit: PAGE_SIZE,
      offset: +id * PAGE_SIZE,
    }),
  )

  return data.results.map((channel) => ({
    url: channel.channel_url,
  }))
}
