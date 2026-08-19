import { requiredEnv } from "@/env"
import { getQueryClient } from "@/app/getQueryClient"
import { learningResourceQueries } from "api/hooks/learningResources"
import { ResourceTypeEnum } from "api"
import { resourceDrawerSearch } from "@/common/urls"
import type { GenerateSitemapResult } from "../types"
import {
  dangerouslyDetectProductionBuildPhase,
  constructSitemap,
} from "../util"

const PAGE_SIZE = 1_000

/**
 * The resource types whose only canonical URL is the resource drawer
 * (`/search?resource=<id>`), because they have no dedicated page.
 *
 * Video, VideoPlaylist, Podcast and PodcastEpisode are deliberately absent:
 * each already has a dedicated page submitted by ../video/sitemap.ts or
 * ../podcast/sitemap.ts. Submitting the drawer URL as well would advertise two
 * self-canonical URLs for the same content and leave crawlers to split ranking
 * signal between them.
 *
 * This is an inclusion list rather than an exclusion because the summary
 * endpoint's `resource_type` filter only supports inclusion (see
 * `LearningResourceFilter.resource_type`), and `resource_type_group` cannot
 * express it either — its "learning_material" group lumps videos and podcasts
 * together with documents and learning paths. A new resource type therefore
 * needs a decision here: if it gets a dedicated page, add it to that page's
 * sitemap; if it lives only in the drawer, add it below.
 */
const RESOURCE_TYPES = [
  ResourceTypeEnum.Course,
  ResourceTypeEnum.Program,
  ResourceTypeEnum.LearningPath,
  ResourceTypeEnum.Document,
]

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
      // MUST match the page query's filter, or the shard count stops matching
      // the rows the shards emit.
      resource_type: RESOURCE_TYPES,
    }),
  )

  const pages = Math.ceil(count / PAGE_SIZE)

  return new Array(pages).fill(null).map((_, index) => ({
    id: index,
    // Used by the sitemap index file
    location: `${BASE_URL}/sitemaps/resources/sitemap/${index}.xml`,
  }))
}

export default constructSitemap(async (page) => {
  const BASE_URL = requiredEnv("NEXT_PUBLIC_ORIGIN")
  const queryClient = getQueryClient()
  const data = await queryClient.fetchQuery(
    learningResourceQueries.summaryList({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      resource_type: RESOURCE_TYPES,
    }),
  )

  return data.results.map((resource) => ({
    url: `${BASE_URL}${resourceDrawerSearch(resource.id, resource.title)}`,
    /**
     * `last_modified` is kept as lastmod deliberately.
     *
     * It is not an ingest clock: the loaders copy it from whatever the upstream
     * source reports changed (openedx course `modified`, program
     * `data_modified_timestamp`, the OCW course's S3 object mtime), so an ETL
     * run over unchanged content does not move it. It is coarser than a true
     * content-change date — an upstream metadata-only edit bumps it, and OCW's
     * is a re-publish timestamp — but a drawer URL renders the resource's
     * metadata (title, description, run dates, price), which is exactly what
     * those upstream timestamps track. So the imprecision is small for the
     * types emitted here.
     *
     * Omitting the field would be worse: crawlers fall back to their own
     * heuristics with no signal at all, and an unreliable lastmod gets ignored
     * rather than counted against the sitemap. Revisit if we ever expose a real
     * content-change date.
     */
    lastModified: resource.last_modified ?? undefined,
  }))
})
