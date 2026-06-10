import { requiredEnv } from "@/env"
import type { MetadataRoute } from "next"
import { getQueryClient } from "@/app/getQueryClient"
import { learningResourceQueries } from "api/hooks/learningResources"
import { ResourceTypeEnum } from "api"
import { videoDetailPageView, videoPlaylistPageView } from "@/common/urls"
import { videoPlaylistIds } from "@/common/slugs"
import type { GenerateSitemapResult, GeneratedSitemapArgs } from "../types"
import { dangerouslyDetectProductionBuildPhase } from "../util"

const PAGE_SIZE = 1_000

const RESOURCE_TYPES = [ResourceTypeEnum.Video, ResourceTypeEnum.VideoPlaylist]

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
      limit: 1,
      resource_type: RESOURCE_TYPES,
    }),
  )

  const pages = Math.ceil(count / PAGE_SIZE)

  return new Array(pages).fill(null).map((_, index) => ({
    id: index,
    location: `${BASE_URL}/sitemaps/video/sitemap/${index}.xml`,
  }))
}

export default async function sitemap({
  id,
}: GeneratedSitemapArgs): Promise<MetadataRoute.Sitemap> {
  const page = +(await id)
  const BASE_URL = requiredEnv("NEXT_PUBLIC_ORIGIN")
  const queryClient = getQueryClient()
  const data = await queryClient.fetchQuery(
    learningResourceQueries.list({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      resource_type: RESOURCE_TYPES,
    }),
  )

  return data.results.flatMap((resource) => {
    if (resource.resource_type === ResourceTypeEnum.Video) {
      // Emit the true canonical: a video with playlists redirects bare →
      // playlists[0], so include it (couples to playlists[0] ordering, same as
      // the canonical tag + page redirect — no new coupling).
      const [firstPlaylist] = videoPlaylistIds(resource)
      return [
        {
          url: `${BASE_URL}${videoDetailPageView(
            resource.id,
            firstPlaylist,
            resource.title,
          )}`,
          lastModified: resource.last_modified ?? undefined,
        },
      ]
    }
    if (resource.resource_type === ResourceTypeEnum.VideoPlaylist) {
      return [
        {
          url: `${BASE_URL}${videoPlaylistPageView(
            String(resource.id),
            resource.title,
          )}`,
          lastModified: resource.last_modified ?? undefined,
        },
      ]
    }
    return []
  })
}
