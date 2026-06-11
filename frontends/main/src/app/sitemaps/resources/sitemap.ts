import { requiredEnv } from "@/env"
import type { MetadataRoute } from "next"
import { getQueryClient } from "@/app/getQueryClient"
import { learningResourceQueries } from "api/hooks/learningResources"
import type { GenerateSitemapResult, GeneratedSitemapArgs } from "../types"
import { dangerouslyDetectProductionBuildPhase } from "../util"

const PAGE_SIZE = 1_000

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
  const BASE_URL = requiredEnv("NEXT_PUBLIC_ORIGIN")
  const queryClient = getQueryClient()
  const { count } = await queryClient.fetchQuery(
    learningResourceQueries.summaryList({
      limit: PAGE_SIZE,
    }),
  )

  const pages = Math.ceil(count / PAGE_SIZE)

  return new Array(pages).fill(null).map((_, index) => ({
    id: index,
    // Used by the sitemap index file
    location: `${BASE_URL}/sitemaps/resources/sitemap/${index}.xml`,
  }))
}

export default async function sitemap({
  id,
}: GeneratedSitemapArgs): Promise<MetadataRoute.Sitemap> {
  const page = +(await id)
  const BASE_URL = requiredEnv("NEXT_PUBLIC_ORIGIN")
  const queryClient = getQueryClient()
  const data = await queryClient.fetchQuery(
    learningResourceQueries.summaryList({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
  )

  return data.results.map((resource) => ({
    url: `${BASE_URL}/search?resource=${resource.id}`,
    lastModified: resource.last_modified ?? undefined,
  }))
}
