import { requiredEnv } from "@/env"
import { getQueryClient } from "@/app/getQueryClient"
import { learningResourceQueries } from "api/hooks/learningResources"
import type { GenerateSitemapResult } from "../types"
import {
  dangerouslyDetectProductionBuildPhase,
  constructSitemap,
} from "../util"

const PAGE_SIZE = 1_000

/**
 * Every published resource, submitted under exactly one URL.
 *
 * `learn_url` is the resource's location within Learn — its own page where it
 * has one (videos, playlists, podcasts, episodes, MITx Online courses and
 * programs), else the search drawer. Because the backend decides, this sitemap
 * covers every resource type on its own: the separate video, podcast and
 * products sitemaps existed only to emit dedicated-page URLs the frontend had
 * to construct itself, and submitted them *alongside* the drawer URL this
 * sitemap emitted for the same resource. That advertised two self-canonical
 * URLs per video and per episode and left crawlers no way to pick a winner.
 *
 * It also settles which parent scopes an episode's URL. This sitemap emits one
 * URL per resource; the podcast sitemap mapped over every parent podcast, so an
 * episode with two parents would have been submitted twice.
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
    // Only the count is read; a full page of rows would be fetched and thrown
    // away.
    learningResourceQueries.summaryList({ limit: 1 }),
  )

  const pages = Math.ceil(count / PAGE_SIZE)

  return new Array(pages).fill(null).map((_, index) => ({
    id: index,
    // Used by the sitemap index file
    location: `${BASE_URL}/sitemaps/resources/sitemap/${index}.xml`,
  }))
}

export default constructSitemap(async (page) => {
  const queryClient = getQueryClient()
  const data = await queryClient.fetchQuery(
    learningResourceQueries.summaryList({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
  )

  return data.results.map((resource) => ({
    // Absolute already — the backend builds it from APP_BASE_URL.
    url: resource.learn_url,
    /**
     * `last_modified` is an upstream change timestamp (openedx course
     * `modified`, program `data_modified_timestamp`, the OCW course's S3 object
     * mtime), not an ingest clock, so an ETL run over unchanged content does not
     * move it. Coarser than a true content-change date, but it tracks the
     * metadata these pages actually render. Omitting it would leave crawlers
     * with no signal at all.
     */
    lastModified: resource.last_modified ?? undefined,
  }))
})
