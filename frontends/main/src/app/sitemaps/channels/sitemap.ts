import type { MetadataRoute } from "next"
import invariant from "tiny-invariant"
import type { GenerateSitemapResult } from "../types"
import { dangerouslyDetectProductionBuildPhase } from "../util"
import { getQueryClient } from "@/app/getQueryClient"
import { channelQueries } from "api/hooks/channels"

const BASE_URL = process.env.NEXT_PUBLIC_ORIGIN
invariant(BASE_URL, "NEXT_PUBLIC_ORIGIN must be defined")

const PAGE_SIZE = 100

/**
 * As of NextJS 15.5.3, sitemaps are ALWAYS generated at build time, even with
 * the force-dynamic below (this may be a NextJS bug?). However, the
 * force-dynamic does force re-generation when requests are made in production.
 */
export const dynamic = "force-dynamic"

export async function generateSitemaps(): Promise<GenerateSitemapResult[]> {
  /**
   * NextJS runs this at build time (despite force-dynamic above).
   * Early exit here to avoid the useless build-time API calls.
   */
  if (dangerouslyDetectProductionBuildPhase()) return []
  const queryClient = getQueryClient()
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
  const queryClient = getQueryClient()
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
